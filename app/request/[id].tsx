import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { logEvent } from '../../lib/events';
import { useAuth } from '../_layout';
import { colors, font, spacing, radius } from '../../constants/theme';
import { TRANSACTION_TYPE_LABELS } from '../../constants/config';
import type { TransactionType } from '../../lib/types';

// ── Types ─────────────────────────────────────────────────────

interface RequestDetail {
  id: string;
  author_id: string;
  text: string;
  transaction_type: TransactionType;
  budget_text: string | null;
  area: string;
  status: string;
  created_at: string;
  author: { display_name: string; rating_avg: number; deals_count: number } | null;
  category: { name: string } | null;
  response_count: number;
}

interface PlugResponse {
  id: string;
  message: string;
  price_text: string | null;
  created_at: string;
  plug: { id: string; display_name: string; rating_avg: number } | null;
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function coerceOne<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

// ── Screen ────────────────────────────────────────────────────

export default function RequestDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, blockUser } = useAuth();

  const [req, setReq] = useState<RequestDetail | null>(null);
  const [responses, setResponses] = useState<PlugResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Plug respond form
  const [offerText, setOfferText] = useState('');
  const [priceText, setPriceText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAuthor = req?.author_id === session?.user?.id;
  const canRespond = !isAuthor && req?.status === 'open';

  useEffect(() => {
    if (!id) return;
    fetchRequest();
  }, [id]);

  // If plug already has a chat for this request, send them straight there
  useEffect(() => {
    if (!session?.user || !id || isAuthor || loading) return;
    supabase
      .from('chats')
      .select('id')
      .eq('request_id', id)
      .eq('plug_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) router.replace(`/chat/${data.id}`);
      });
  }, [id, session?.user?.id, isAuthor, loading]);

  const fetchRequest = async () => {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id, author_id, text, transaction_type, budget_text, area, status, created_at,
        author:profiles!author_id(display_name, rating_avg, deals_count),
        category:categories!category_id(name),
        responses(id)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      setLoading(false);
      return;
    }

    setReq({
      ...data,
      author: coerceOne(data.author as any),
      category: coerceOne(data.category as any),
      response_count: Array.isArray(data.responses) ? data.responses.length : 0,
    });

    // Fetch responses if author
    if (data.author_id === session?.user?.id) {
      const { data: resps } = await supabase
        .from('responses')
        .select(`
          id, message, price_text, created_at,
          plug:profiles!plug_id(id, display_name, rating_avg)
        `)
        .eq('request_id', id)
        .order('created_at', { ascending: false });

      if (resps) {
        setResponses(resps.map((r: any) => ({ ...r, plug: coerceOne(r.plug) })));
      }
    }

    setLoading(false);
  };

  const handleRespond = async () => {
    if (!offerText.trim() || !session?.user || !req) return;
    setSubmitting(true);

    // 1. Insert response
    const { data: resp, error: respErr } = await supabase
      .from('responses')
      .insert({
        request_id: req.id,
        plug_id: session.user.id,
        message: offerText.trim(),
        price_text: priceText.trim() || null,
        status: 'sent',
      })
      .select('id')
      .single();

    if (respErr) {
      setSubmitting(false);
      Alert.alert('Could not send offer', respErr.message);
      return;
    }

    // 2. Create chat (plug → buyer)
    const { data: chat, error: chatErr } = await supabase
      .from('chats')
      .insert({
        request_id: req.id,
        buyer_id: req.author_id,
        plug_id: session.user.id,
      })
      .select('id')
      .single();

    if (chatErr) {
      setSubmitting(false);
      Alert.alert('Could not open chat', chatErr.message);
      return;
    }

    // 3. Log event
    await logEvent('response_sent', {
      request_id: req.id,
      response_id: resp.id,
      chat_id: chat.id,
    }, session.user.id);

    setSubmitting(false);
    router.replace(`/chat/${chat.id}`);
  };

  const handleFulfill = () => {
    Alert.alert(
      'Mark as fulfilled?',
      "This closes the request and removes it from the feed. You can't undo this.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Yes, it's sorted",
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('requests')
              .update({ status: 'closed' })
              .eq('id', req!.id)
              .eq('author_id', session!.user!.id);
            if (error) {
              Alert.alert('Something went wrong', error.message);
              return;
            }
            await logEvent('request_closed', { request_id: req!.id }, session!.user!.id);
            setReq(r => r ? { ...r, status: 'closed' } : r);
          },
        },
      ],
    );
  };

  const handleReport = () => {
    if (!req || !session?.user) return;
    const name = req.author?.display_name ?? 'this user';
    Alert.alert('Report or block', name, [
      { text: 'Report', onPress: showReportReasons },
      { text: `Block ${name}`, style: 'destructive', onPress: () => handleBlock(req.author_id, req.author?.display_name) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const showReportReasons = () => {
    if (!req || !session?.user) return;
    Alert.alert("What's the issue?", undefined, [
      { text: 'Harmful or fraudulent', onPress: () => submitReport('request', req.id, 'harmful') },
      { text: 'Exam malpractice', onPress: () => submitReport('request', req.id, 'malpractice') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleBlock = (targetId: string, name?: string) => {
    Alert.alert(
      `Block ${name ?? 'this user'}?`,
      "You won't see their content and they won't see yours. This also files a report.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await blockUser(targetId);
            Alert.alert('Blocked', "You won't see content from this user.");
            router.back();
          },
        },
      ],
    );
  };

  const submitReport = async (targetType: 'request' | 'user' | 'message', targetId: string, reason: string) => {
    if (!session?.user) return;
    await supabase.from('reports').insert({
      reporter_id: session.user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
    });
    await logEvent('report_filed', { target_type: targetType, target_id: targetId, reason }, session.user.id);
    Alert.alert('Reported', "Thanks — we'll review this and act if needed.");
  };

  // Author: navigate to existing chat with a plug
  const openChatWithPlug = async (plugId: string) => {
    const { data } = await supabase
      .from('chats')
      .select('id')
      .eq('request_id', id)
      .eq('plug_id', plugId)
      .maybeSingle();
    if (data) router.push(`/chat/${data.id}`);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  if (!req) {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.errorText}>Request not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Request</Text>
        {!isAuthor && req ? (
          <TouchableOpacity onPress={handleReport} style={styles.moreBtn}>
            <Text style={styles.moreText}>⋯</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
      >
        {/* Category + tx type */}
        <View style={styles.tagRow}>
          <View style={styles.catTag}>
            <Text style={styles.catTagText}>{req.category?.name ?? 'Other'}</Text>
          </View>
          <Text style={styles.txType}>{TRANSACTION_TYPE_LABELS[req.transaction_type]}</Text>
          <Text style={styles.timeAgo}>{timeAgo(req.created_at)}</Text>
        </View>

        {/* Request text */}
        <Text style={styles.reqText}>{req.text}</Text>

        {/* Meta */}
        <View style={styles.metaRow}>
          <Text style={styles.metaItem}>📍 {req.area}</Text>
          {req.budget_text ? <Text style={styles.metaItem}>· {req.budget_text}</Text> : null}
        </View>

        {/* Author card */}
        <View style={styles.authorCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.authorName}>{req.author?.display_name ?? '—'}</Text>
            <Text style={styles.authorMeta}>
              ⭐ {Number(req.author?.rating_avg ?? 0).toFixed(1)} · {req.author?.deals_count ?? 0} deal{req.author?.deals_count !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.statusPill, req.status !== 'open' && styles.statusPillClosed]}>
            <Text style={[styles.statusText, req.status !== 'open' && styles.statusTextClosed]}>
              {req.status}
            </Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Author view — list of plug responses */}
        {isAuthor && (
          <>
            <Text style={styles.sectionLabel}>
              {responses.length === 0 ? 'No offers yet' : `${responses.length} plug${responses.length > 1 ? 's' : ''} offered`}
            </Text>
            {req.status === 'open' && (
              <TouchableOpacity style={styles.fulfillBtn} onPress={handleFulfill} activeOpacity={0.8}>
                <Text style={styles.fulfillBtnText}>✓ Mark as fulfilled</Text>
              </TouchableOpacity>
            )}
            {responses.map(r => (
              <View key={r.id} style={styles.respCard}>
                <View style={styles.respHeader}>
                  <Text style={styles.respName}>{r.plug?.display_name ?? '—'}</Text>
                  <Text style={styles.respRating}>⭐ {Number(r.plug?.rating_avg ?? 0).toFixed(1)}</Text>
                  <Text style={styles.respTime}>{timeAgo(r.created_at)}</Text>
                </View>
                <Text style={styles.respMessage}>{r.message}</Text>
                {r.price_text ? <Text style={styles.respPrice}>{r.price_text}</Text> : null}
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => r.plug && openChatWithPlug(r.plug.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.chatBtnText}>Open chat →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Plug view — respond form */}
        {canRespond && (
          <>
            <Text style={styles.sectionLabel}>Make an offer</Text>
            <TextInput
              style={styles.offerInput}
              value={offerText}
              onChangeText={setOfferText}
              placeholder="Tell them what you can do…"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!submitting}
            />
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Your price (optional)</Text>
              <TextInput
                style={styles.priceInput}
                value={priceText}
                onChangeText={setPriceText}
                placeholder="e.g. ₦1,500"
                placeholderTextColor={colors.textMuted}
                editable={!submitting}
              />
            </View>
            <TouchableOpacity
              style={[styles.respondBtn, (!offerText.trim() || submitting) && styles.respondBtnDisabled]}
              onPress={handleRespond}
              disabled={!offerText.trim() || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.respondBtnText}>I've got this →</Text>}
            </TouchableOpacity>
          </>
        )}

        {/* Already responded / closed */}
        {!isAuthor && !canRespond && (
          <View style={styles.closedBox}>
            <Text style={styles.closedText}>
              {req.status === 'open'
                ? 'Checking your offer…'
                : 'This request is no longer open.'}
            </Text>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 60 },
  backText: { fontFamily: font.bodySemi, fontSize: 14, color: colors.primary },
  moreBtn: { width: 60, alignItems: 'flex-end' },
  moreText: { fontFamily: font.bodyBold, fontSize: 20, color: colors.textSecondary },
  topTitle: {
    fontFamily: font.heading, fontSize: 18,
    color: colors.textPrimary, letterSpacing: -0.2,
  },

  scroll: { padding: spacing.lg, gap: 14 },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7,
  },
  catTagText: {
    fontFamily: font.bodyExtra, fontSize: 10,
    color: colors.primary, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  txType: { fontFamily: font.bodySemi, fontSize: 12, color: colors.textMuted },
  timeAgo: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textMuted, marginLeft: 'auto',
  },

  reqText: {
    fontFamily: font.bodySemi, fontSize: 18,
    color: colors.textPrimary, lineHeight: 26,
  },

  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaItem: { fontFamily: font.bodySemi, fontSize: 13, color: colors.textSecondary },

  authorCard: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  authorName: { fontFamily: font.bodyBold, fontSize: 15, color: colors.textPrimary },
  authorMeta: { fontFamily: font.bodySemi, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  statusPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  statusPillClosed: { backgroundColor: colors.muted },
  statusText: { fontFamily: font.bodyBold, fontSize: 12, color: colors.primary },
  statusTextClosed: { color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.border },

  sectionLabel: {
    fontFamily: font.bodyExtra, fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  // Author — response list
  respCard: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.md, gap: 8,
  },
  respHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  respName: { fontFamily: font.bodyBold, fontSize: 14, color: colors.textPrimary, flex: 1 },
  respRating: { fontFamily: font.bodySemi, fontSize: 12, color: colors.textSecondary },
  respTime: { fontFamily: font.bodySemi, fontSize: 12, color: colors.textMuted },
  respMessage: { fontFamily: font.body, fontSize: 14, color: colors.textPrimary, lineHeight: 21 },
  respPrice: { fontFamily: font.bodyBold, fontSize: 14, color: colors.primary },
  chatBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 12, alignItems: 'center',
  },
  chatBtnText: { fontFamily: font.bodyExtra, fontSize: 14, color: '#fff' },

  // Plug — respond form
  offerInput: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg, padding: spacing.md,
    fontFamily: font.body, fontSize: 15, color: colors.textPrimary,
    minHeight: 90,
  },
  priceRow: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  priceLabel: { fontFamily: font.bodySemi, fontSize: 13.5, color: colors.textSecondary },
  priceInput: {
    fontFamily: font.bodyBold, fontSize: 15, color: colors.textPrimary,
    textAlign: 'right', minWidth: 100,
  },
  respondBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg, paddingVertical: 17, alignItems: 'center',
  },
  respondBtnDisabled: { opacity: 0.4 },
  respondBtnText: { fontFamily: font.bodyExtra, fontSize: 16, color: '#fff' },

  closedBox: {
    backgroundColor: colors.muted, borderRadius: radius.lg, padding: spacing.md,
  },
  closedText: {
    fontFamily: font.body, fontSize: 13.5,
    color: colors.textSecondary, textAlign: 'center',
  },

  errorText: {
    fontFamily: font.body, fontSize: 14,
    color: colors.textSecondary, textAlign: 'center', marginTop: 40,
  },

  fulfillBtn: {
    borderWidth: 1, borderColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center',
  },
  fulfillBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.primary },
});
