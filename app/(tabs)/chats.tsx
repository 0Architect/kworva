import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import { colors, font, spacing, radius } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────

interface ChatRow {
  id: string;
  created_at: string;
  request: { text: string } | null;
  buyer: { display_name: string } | null;
  plug: { display_name: string } | null;
  buyer_id: string;
  plug_id: string;
}

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

// ── Screen ────────────────────────────────────────────────────

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { session, blockedIds } = useAuth();
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchChats = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('chats')
      .select(`
        id, created_at, buyer_id, plug_id,
        request:requests!request_id(text),
        buyer:profiles!buyer_id(display_name),
        plug:profiles!plug_id(display_name)
      `)
      .or(`buyer_id.eq.${session.user.id},plug_id.eq.${session.user.id}`)
      .order('created_at', { ascending: false });

    if (data) {
      setChats(data
        .map((c: any) => ({
          ...c,
          request: coerceOne(c.request),
          buyer: coerceOne(c.buyer),
          plug: coerceOne(c.plug),
        }))
        .filter((c: ChatRow) => {
          const otherId = c.buyer_id === session?.user?.id ? c.plug_id : c.buyer_id;
          return !blockedIds.has(otherId);
        }),
      );
    }
  }, [session?.user]);

  useEffect(() => {
    setLoading(true);
    fetchChats().finally(() => setLoading(false));
  }, [fetchChats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  }, [fetchChats]);

  const renderChat = ({ item }: { item: ChatRow }) => {
    const isBuyer = item.buyer_id === session?.user?.id;
    const otherName = isBuyer ? item.plug?.display_name : item.buyer?.display_name;
    const role = isBuyer ? 'you asked' : 'you offered';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => router.push(`/chat/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherName?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <Text style={styles.nameText} numberOfLines={1}>{otherName ?? '—'}</Text>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.reqText} numberOfLines={1}>{item.request?.text ?? '—'}</Text>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.screenTitle}>Chats</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={chats}
          keyExtractor={c => c.id}
          renderItem={renderChat}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={chats.length === 0 ? styles.emptyContainer : undefined}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>No chats yet</Text>
              <Text style={styles.emptySub}>
                When you tap "I've got this" on a request,{'\n'}the conversation opens here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: '#fff',
  },
  screenTitle: {
    fontFamily: font.heading, fontSize: 22,
    color: colors.textPrimary, letterSpacing: -0.3,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    backgroundColor: '#fff', gap: 14,
  },
  sep: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 52 },

  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontFamily: font.bodyBold, fontSize: 18, color: colors.primary },

  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  nameText: { fontFamily: font.bodyBold, fontSize: 15, color: colors.textPrimary, flex: 1 },
  timeText: { fontFamily: font.bodySemi, fontSize: 11.5, color: colors.textMuted },
  reqText: { fontFamily: font.body, fontSize: 13.5, color: colors.textSecondary, marginTop: 2 },
  roleText: { fontFamily: font.bodySemi, fontSize: 11.5, color: colors.textMuted, marginTop: 3 },

  emptyContainer: { flex: 1 },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 10,
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontFamily: font.heading, fontSize: 20, color: colors.textPrimary },
  emptySub: {
    fontFamily: font.body, fontSize: 13.5,
    color: colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },
});
