import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { logEvent } from '../../lib/events';
import { useAuth } from '../_layout';
import { colors, font, spacing, radius } from '../../constants/theme';
import type { Message } from '../../lib/types';

// ── Types ─────────────────────────────────────────────────────

interface ChatMeta {
  id: string;
  request_id: string;
  buyer_id: string;
  plug_id: string;
  request: { id: string; text: string } | null;
  buyer: { display_name: string } | null;
  plug: { display_name: string } | null;
}

function coerceOne<T>(val: T | T[] | null): T | null {
  if (!val) return null;
  return Array.isArray(val) ? (val[0] ?? null) : val;
}

// ── Screen ────────────────────────────────────────────────────

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, blockUser } = useAuth();

  const [chat, setChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList>(null);

  const otherName = chat
    ? (chat.buyer_id === session?.user?.id ? chat.plug?.display_name : chat.buyer?.display_name) ?? '—'
    : '…';

  const fetchAll = useCallback(async () => {
    if (!id) return;

    const [{ data: chatData }, { data: msgData }] = await Promise.all([
      supabase
        .from('chats')
        .select(`
          id, request_id, buyer_id, plug_id,
          request:requests!request_id(id, text),
          buyer:profiles!buyer_id(display_name),
          plug:profiles!plug_id(display_name)
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (chatData) {
      setChat({
        ...chatData,
        request: coerceOne(chatData.request as any),
        buyer: coerceOne(chatData.buyer as any),
        plug: coerceOne(chatData.plug as any),
      });
    }
    if (msgData) setMessages(msgData as Message[]);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  // Realtime — append incoming messages instantly
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages(prev => {
            // Deduplicate: skip if we already have this id (optimistic insert from send())
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Scroll to bottom when messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [messages.length]);

  const handleReport = () => {
    if (!chat || !session?.user) return;
    const otherId = chat.buyer_id === session.user.id ? chat.plug_id : chat.buyer_id;
    const otherNameVal = chat.buyer_id === session.user.id
      ? chat.plug?.display_name
      : chat.buyer?.display_name;
    const name = otherNameVal ?? 'this user';
    Alert.alert('Report or block', name, [
      { text: 'Report', onPress: () => showChatReportReasons(otherId) },
      { text: `Block ${name}`, style: 'destructive', onPress: () => handleBlock(otherId, otherNameVal) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const showChatReportReasons = (otherId: string) => {
    if (!session?.user) return;
    Alert.alert("What's the issue?", undefined, [
      { text: 'Harmful or fraudulent', onPress: () => submitReport('user', otherId, 'harmful') },
      { text: 'Harassment', onPress: () => submitReport('user', otherId, 'harassment') },
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

  const send = async () => {
    const body = draft.trim();
    if (!body || !session?.user || !id || sending) return;
    setSending(true);
    setDraft('');

    const { data: msg } = await supabase
      .from('messages')
      .insert({ chat_id: id, sender_id: session.user.id, body })
      .select('*')
      .single();

    if (msg) {
      setMessages(prev => [...prev, msg as Message]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }

    await logEvent('message_sent', { chat_id: id }, session.user.id);
    setSending(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const mine = item.sender_id === session?.user?.id;
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
          {item.body}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.otherName} numberOfLines={1}>{otherName}</Text>
          {chat?.request && (
            <Text style={styles.reqSnippet} numberOfLines={1}>
              re: {chat.request.text}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={handleReport} style={styles.moreBtn}>
          <Text style={styles.moreText}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Say hi. Sort out the details here — meet up, share a pin, whatever works.
              </Text>
            </View>
          }
        />
      )}

      {/* Input row */}
      <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message…"
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!sending}
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!draft.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.sendIcon}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  backBtn: { width: 60 },
  backText: { fontFamily: font.bodySemi, fontSize: 14, color: colors.primary },
  moreBtn: { width: 60, alignItems: 'flex-end' },
  moreText: { fontFamily: font.bodyBold, fontSize: 20, color: colors.textSecondary },
  headerCenter: { flex: 1, alignItems: 'center' },
  otherName: {
    fontFamily: font.bodyBold, fontSize: 15,
    color: colors.textPrimary,
  },
  reqSnippet: {
    fontFamily: font.bodySemi, fontSize: 11.5,
    color: colors.textMuted, marginTop: 2,
  },

  listContent: {
    padding: spacing.lg,
    gap: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18,
    marginVertical: 2,
  },
  bubbleMine: {
    backgroundColor: colors.primary,
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  bubbleTextMine: { color: '#fff' },
  bubbleTextTheirs: { color: colors.textPrimary },

  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyText: {
    fontFamily: font.body, fontSize: 13.5,
    color: colors.textSecondary, textAlign: 'center', lineHeight: 21,
  },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: font.body, fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendIcon: { fontSize: 20, color: '#fff', fontWeight: '700', lineHeight: 24 },
});
