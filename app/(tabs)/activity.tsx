import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import { colors, font, spacing, radius } from '../../constants/theme';
import { TRANSACTION_TYPE_LABELS } from '../../constants/config';
import type { TransactionType } from '../../lib/types';

// ── Types ─────────────────────────────────────────────────────

interface MyRequest {
  id: string;
  text: string;
  transaction_type: TransactionType;
  budget_text: string | null;
  category: { name: string } | null;
  created_at: string;
  response_count: number;
}

interface OfferRequest {
  id: string;
  text: string;
  transaction_type: TransactionType;
  budget_text: string | null;
  area: string;
  created_at: string;
  author: { display_name: string } | null;
  category: { name: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function coerceOne<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

// ── Sub-components ────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function MyRequestRow({ req, onPress }: { req: MyRequest; onPress: () => void }) {
  const n = req.response_count;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardText} numberOfLines={2}>{req.text}</Text>
          <Text style={styles.cardSub}>
            {req.category?.name ?? 'Other'} · {TRANSACTION_TYPE_LABELS[req.transaction_type]}
            {req.budget_text ? ` · ${req.budget_text}` : ''}
          </Text>
        </View>
        {n > 0 ? (
          <View style={styles.respPill}>
            <Text style={styles.respPillText}>{n} resp.</Text>
          </View>
        ) : (
          <Text style={styles.waiting}>waiting…</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

function OfferRow({ req, onPress }: { req: OfferRequest; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.offerTop}>
        <View style={styles.catTag}>
          <Text style={styles.catTagText}>{req.category?.name ?? 'Other'}</Text>
        </View>
        <Text style={styles.txBadge}>{TRANSACTION_TYPE_LABELS[req.transaction_type]}</Text>
        <Text style={styles.timeAgo}>{timeAgo(req.created_at)}</Text>
      </View>
      <Text style={styles.cardText} numberOfLines={2}>{req.text}</Text>
      <View style={styles.offerMeta}>
        <Text style={styles.metaText}>📍 {req.area}</Text>
        {req.budget_text ? <Text style={styles.metaText}>· {req.budget_text}</Text> : null}
        <Text style={styles.metaText}>· {req.author?.display_name ?? '—'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [offers, setOffers] = useState<OfferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMyRequests = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('requests')
      .select(`
        id, text, transaction_type, budget_text, created_at,
        category:categories!category_id(name),
        responses(id)
      `)
      .eq('author_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setMyRequests(data.map((r: any) => ({
        ...r,
        category: coerceOne(r.category),
        response_count: Array.isArray(r.responses) ? r.responses.length : 0,
      })));
    }
  }, [session?.user]);

  const fetchOffers = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('requests')
      .select(`
        id, text, transaction_type, budget_text, area, created_at,
        author:profiles!author_id(display_name),
        category:categories!category_id(name)
      `)
      .eq('status', 'open')
      .neq('author_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (data) {
      setOffers(data.map((r: any) => ({
        ...r,
        author: coerceOne(r.author),
        category: coerceOne(r.category),
      })));
    }
  }, [session?.user]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchMyRequests(), fetchOffers()]);
  }, [fetchMyRequests, fetchOffers]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // Realtime — refetch offers when any new open request is inserted
  useEffect(() => {
    if (!session?.user) return;

    const channel = supabase
      .channel('activity-requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'requests' },
        (payload) => {
          if (payload.new.author_id !== session.user.id) {
            fetchOffers();
          } else {
            fetchMyRequests();
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'responses' },
        () => fetchMyRequests(),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session?.user, fetchOffers, fetchMyRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  if (loading) {
    return (
      <View style={styles.root}>
        <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}><Text style={styles.screenTitle}>Activity</Text></View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.screenTitle}>Activity</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Your requests */}
        <SectionHeader title="Your requests" />
        {myRequests.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>You haven't posted yet. Tap + to ask for anything.</Text>
          </View>
        ) : (
          myRequests.map(r => (
            <MyRequestRow key={r.id} req={r} onPress={() => router.push(`/request/${r.id}`)} />
          ))
        )}

        {/* Offers for you */}
        <SectionHeader title="Offers for you" />
        {offers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              No open requests yet. When someone posts a need near you, it shows up here.
              {'\n\n'}Add capacity tags in your profile so Kworva can match you better.
            </Text>
          </View>
        ) : (
          offers.map(r => (
            <OfferRow key={r.id} req={r} onPress={() => router.push(`/request/${r.id}`)} />
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  screenTitle: {
    fontFamily: font.heading, fontSize: 22,
    color: colors.textPrimary, letterSpacing: -0.3,
  },

  sectionTitle: {
    fontFamily: font.bodyExtra, fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl, marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl,
    marginHorizontal: spacing.lg, marginBottom: 10,
    padding: spacing.md,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardText: {
    fontFamily: font.bodySemi, fontSize: 15,
    color: colors.textPrimary, lineHeight: 21,
  },
  cardSub: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textSecondary,
  },

  respPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, flexShrink: 0,
  },
  respPillText: {
    fontFamily: font.bodyBold, fontSize: 12, color: colors.primary,
  },
  waiting: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textMuted, fontStyle: 'italic',
  },

  offerTop: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  catTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  catTagText: {
    fontFamily: font.bodyExtra, fontSize: 10,
    color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  txBadge: {
    fontFamily: font.bodySemi, fontSize: 11.5, color: colors.textMuted,
  },
  timeAgo: {
    fontFamily: font.bodySemi, fontSize: 11.5,
    color: colors.textMuted, marginLeft: 'auto',
  },
  offerMeta: {
    flexDirection: 'row', gap: 6, flexWrap: 'wrap',
  },
  metaText: {
    fontFamily: font.bodySemi, fontSize: 12, color: colors.textSecondary,
  },

  emptyBox: {
    backgroundColor: colors.muted, borderRadius: radius.xl,
    marginHorizontal: spacing.lg, padding: spacing.md,
  },
  emptyText: {
    fontFamily: font.body, fontSize: 13.5,
    color: colors.textSecondary, lineHeight: 20,
  },
});
