import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import { colors, font, spacing, radius } from '../../constants/theme';
import { TRANSACTION_TYPE_LABELS } from '../../constants/config';
import type { Category, TransactionType } from '../../lib/types';

// ── Types ─────────────────────────────────────────────────────

interface FeedRequest {
  id: string;
  author_id: string;
  text: string;
  transaction_type: TransactionType;
  budget_text: string | null;
  area: string;
  created_at: string;
  author: { display_name: string; area: string } | null;
  category: { id: string; name: string } | null;
  response_count: number;
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

// ── Request card ──────────────────────────────────────────────

function RequestCard({ req, onPress }: { req: FeedRequest; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.cardHeader}>
        <View style={styles.catTag}>
          <Text style={styles.catTagText}>{req.category?.name ?? 'Other'}</Text>
        </View>
        <Text style={styles.txType}>{TRANSACTION_TYPE_LABELS[req.transaction_type]}</Text>
      </View>

      <Text style={styles.cardText} numberOfLines={3}>{req.text}</Text>

      <View style={styles.cardMeta}>
        <Text style={styles.metaItem}>📍 {req.area}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaItem}>🕐 {timeAgo(req.created_at)}</Text>
        {req.budget_text ? (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaItem}>{req.budget_text}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.cardFoot}>
        {req.response_count > 0 ? (
          <View style={styles.respPill}>
            <Text style={styles.respPillText}>✓ {req.response_count} plug{req.response_count > 1 ? 's' : ''} responded</Text>
          </View>
        ) : (
          <Text style={styles.noResp}>be the first plug</Text>
        )}
        <Text style={styles.author}>{req.author?.display_name ?? '—'}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Home feed ─────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, blockedIds } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [requests, setRequests] = useState<FeedRequest[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null); // null = All
  const [selectedTx, setSelectedTx] = useState<TransactionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch categories once
  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setCategories(data); });
  }, []);

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id, author_id, text, transaction_type, budget_text, area, created_at,
        author:profiles!author_id(display_name, area),
        category:categories!category_id(id, name),
        responses(id)
      `)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(60);

    if (data) {
      setRequests(
        data.map((r: any) => ({
          ...r,
          author: Array.isArray(r.author) ? r.author[0] ?? null : r.author,
          category: Array.isArray(r.category) ? r.category[0] ?? null : r.category,
          response_count: Array.isArray(r.responses) ? r.responses.length : 0,
        })),
      );
    }
    if (error) console.warn('[feed]', error.message);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchRequests().finally(() => setLoading(false));
  }, [fetchRequests]);

  // Realtime — refetch when any request is inserted or updated
  useEffect(() => {
    const channel = supabase
      .channel('home-requests')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'requests' },
        () => fetchRequests(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, [fetchRequests]);

  // Apply filters (exclude blocked users' requests)
  const filtered = requests.filter(r => {
    if (blockedIds.has(r.author_id)) return false;
    if (selectedCat && r.category?.id !== selectedCat) return false;
    if (selectedTx && r.transaction_type !== selectedTx) return false;
    return true;
  });

  const txTypes = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[];

  return (
    <View style={styles.root}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 16 }]}>
        <View>
          <Text style={styles.wordmark}>kworva</Text>
          <Text style={styles.tagline}>find your plug · {profile?.campus || 'campus marketplace'}</Text>
        </View>
        <View style={styles.areaPill}>
          <Text style={styles.areaPillText}>📍 {profile?.area ?? '…'}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Hero composer entry */}
        <TouchableOpacity style={styles.hero} onPress={() => router.push('/composer')} activeOpacity={0.88}>
          <Text style={styles.heroLabel}>WHAT DO YOU NEED?</Text>
          <View style={styles.heroInputRow}>
            <Text style={styles.heroPlaceholder}>food, charger, barber, notes…</Text>
          </View>
          <Text style={styles.heroHint}>Type it your way. A plug responds — usually fast.</Text>
        </TouchableOpacity>

        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <TouchableOpacity
            style={[styles.filterChip, !selectedCat && styles.filterChipActive]}
            onPress={() => setSelectedCat(null)}
          >
            <Text style={[styles.filterChipText, !selectedCat && styles.filterChipTextActive]}>All</Text>
          </TouchableOpacity>
          {categories.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.filterChip, selectedCat === c.id && styles.filterChipActive]}
              onPress={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
            >
              <Text style={[styles.filterChipText, selectedCat === c.id && styles.filterChipTextActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Transaction type filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, { marginBottom: 6 }]}>
          {txTypes.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.txChip, selectedTx === t && styles.txChipActive]}
              onPress={() => setSelectedTx(selectedTx === t ? null : t)}
            >
              <Text style={[styles.txChipText, selectedTx === t && styles.txChipTextActive]}>
                {TRANSACTION_TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Feed header */}
        <View style={styles.feedHead}>
          <Text style={styles.feedTitle}>
            {selectedCat ? categories.find(c => c.id === selectedCat)?.name ?? 'Requests' : 'Live on campus'}
          </Text>
          <Text style={styles.feedCount}>{filtered.length} open</Text>
        </View>

        {/* Content */}
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {requests.length === 0
                ? 'No requests yet. Be the first to post — tap the card above.'
                : 'No requests match this filter. Clear a filter or post one yourself.'}
            </Text>
          </View>
        ) : (
          filtered.map(r => (
            <RequestCard
              key={r.id}
              req={r}
              onPress={() => router.push(`/request/${r.id}`)}
            />
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
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: 14,
    backgroundColor: colors.bg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  wordmark: {
    fontFamily: font.heading, fontSize: 26,
    color: colors.primary, letterSpacing: -1,
  },
  tagline: {
    fontFamily: font.bodySemi, fontSize: 11.5,
    color: colors.textSecondary, letterSpacing: 0.2, marginTop: 2,
  },
  areaPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: radius.pill,
  },
  areaPillText: {
    fontFamily: font.bodyBold, fontSize: 12.5,
    color: colors.primary,
  },

  scroll: { flex: 1 },

  hero: {
    margin: spacing.lg, marginBottom: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: 22, padding: spacing.lg,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 16,
  },
  heroLabel: {
    fontFamily: font.bodyExtra, fontSize: 11,
    color: colors.primaryMid, letterSpacing: 1.4,
  },
  heroInputRow: {
    backgroundColor: '#fff', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 14, marginTop: 12,
  },
  heroPlaceholder: {
    fontFamily: font.body, fontSize: 14.5, color: colors.textMuted,
  },
  heroHint: {
    fontFamily: font.bodySemi, fontSize: 12.5,
    color: colors.primaryMid, marginTop: 12,
  },

  chipRow: {
    gap: 8, paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  filterChip: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  filterChipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  filterChipText: {
    fontFamily: font.bodyBold, fontSize: 13,
    color: colors.textSecondary,
  },
  filterChipTextActive: { color: '#fff' },

  txChip: {
    backgroundColor: colors.muted,
    borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  txChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  txChipText: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textSecondary,
  },
  txChipTextActive: { color: colors.primary, fontFamily: font.bodyBold },

  feedHead: {
    flexDirection: 'row', alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: 6, marginBottom: 10,
  },
  feedTitle: {
    fontFamily: font.heading, fontSize: 17,
    color: colors.textPrimary, letterSpacing: -0.2,
  },
  feedCount: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textSecondary,
  },

  card: {
    marginHorizontal: spacing.lg, marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  catTag: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 7,
  },
  catTagText: {
    fontFamily: font.bodyExtra, fontSize: 10,
    color: colors.primary, letterSpacing: 0.6, textTransform: 'uppercase',
  },
  txType: {
    fontFamily: font.bodySemi, fontSize: 11.5,
    color: colors.textMuted,
  },
  cardText: {
    fontFamily: font.bodySemi, fontSize: 15.5,
    color: colors.textPrimary, lineHeight: 22,
  },
  cardMeta: {
    flexDirection: 'row', alignItems: 'center',
    flexWrap: 'wrap', gap: 4, marginTop: 10,
  },
  metaItem: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textSecondary,
  },
  metaDot: { color: colors.textLight, fontSize: 12 },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 13,
  },
  respPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill,
  },
  respPillText: {
    fontFamily: font.bodyBold, fontSize: 12,
    color: colors.primary,
  },
  noResp: {
    fontFamily: font.bodySemi, fontSize: 12.5,
    color: colors.textMuted, fontStyle: 'italic',
  },
  author: {
    fontFamily: font.bodySemi, fontSize: 12,
    color: colors.textMuted,
  },

  empty: {
    backgroundColor: colors.muted, borderRadius: radius.xl,
    marginHorizontal: spacing.lg, padding: 20,
  },
  emptyText: {
    fontFamily: font.body, fontSize: 13.5,
    color: colors.textSecondary, textAlign: 'center', lineHeight: 20,
  },
});
