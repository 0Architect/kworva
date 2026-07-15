import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/events';
import { matchRequest } from '../lib/match';
import { guessCategoryName } from '../lib/guessCat';
import { checkContent } from '../lib/blocklist';
import { useAuth } from './_layout';
import { colors, font, spacing, radius } from '../constants/theme';
import { TRANSACTION_TYPE_LABELS, DEFAULT_EXPIRY_HOURS } from '../constants/config';
import type { Category, TransactionType } from '../lib/types';

const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[];

export default function Composer() {
  const { session, profile } = useAuth();
  const [text, setText] = useState('');
  const [txType, setTxType] = useState<TransactionType | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const textRef = useRef<TextInput>(null);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setCategories(data); });
    textRef.current?.focus();
  }, []);

  // Auto-suggest category when text changes
  useEffect(() => {
    if (!text.trim() || !categories.length) return;
    const guessedName = guessCategoryName(text);
    const match = categories.find(c => c.name === guessedName);
    if (match) setSelectedCatId(match.id);
  }, [text, categories]);

  const canSubmit = text.trim().length > 0 && txType !== null;

  const handlePost = async () => {
    if (!canSubmit || !session?.user || !profile) return;

    const blocked = checkContent(text.trim());
    if (blocked.blocked) {
      Alert.alert(
        'This request can\'t be posted',
        `Kworva doesn't allow ${blocked.reason}. Edit your request and try again.`,
      );
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.from('requests').insert({
      author_id: session.user.id,
      text: text.trim(),
      transaction_type: txType,
      category_id: selectedCatId,
      budget_text: budget.trim() || null,
      area: profile.area,
      expires_at: new Date(Date.now() + DEFAULT_EXPIRY_HOURS * 3600 * 1000).toISOString(),
    }).select('id').single();

    if (error) {
      setLoading(false);
      Alert.alert('Could not post', error.message);
      return;
    }

    await logEvent('request_posted', {
      request_id: data.id,
      transaction_type: txType,
      category_id: selectedCatId,
      area: profile.area,
      has_budget: !!budget.trim(),
    }, session.user.id);

    // Fire matching async — don't block the UI close
    matchRequest(data.id, session.user.id);

    setLoading(false);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Handle bar */}
      <View style={styles.grip} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What do you need?</Text>

        {/* Need text */}
        <TextInput
          ref={textRef}
          style={styles.textarea}
          value={text}
          onChangeText={setText}
          placeholder="food, charger, barber, notes… type it your way"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!loading}
        />

        {/* Transaction type — required */}
        <Text style={styles.sectionLabel}>What kind of transaction? *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {TRANSACTION_TYPES.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.chip, txType === t && styles.chipActive]}
              onPress={() => setTxType(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, txType === t && styles.chipTextActive]}>
                {TRANSACTION_TYPE_LABELS[t]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Category — auto-suggested, overridable */}
        <Text style={styles.sectionLabel}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {categories.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selectedCatId === c.id && styles.chipActive]}
              onPress={() => setSelectedCatId(selectedCatId === c.id ? null : c.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selectedCatId === c.id && styles.chipTextActive]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Budget */}
        <View style={styles.budgetRow}>
          <Text style={styles.budgetLabel}>Budget (optional)</Text>
          <TextInput
            style={styles.budgetInput}
            value={budget}
            onChangeText={setBudget}
            placeholder="e.g. ₦2,000"
            placeholderTextColor={colors.textMuted}
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
          onPress={handlePost}
          disabled={!canSubmit || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.btnText}>Post request →</Text>}
        </TouchableOpacity>

        <Text style={styles.hint}>
          Goes out to plugs near {profile?.area ?? 'your area'}. You'll get a reply, not a dead end.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  grip: {
    width: 40, height: 5, borderRadius: 999,
    backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  scroll: { padding: spacing.lg, paddingBottom: 48, gap: spacing.md },
  title: {
    fontFamily: font.heading, fontSize: 24,
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  textarea: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg,
    padding: spacing.md,
    fontFamily: font.body, fontSize: 15.5,
    color: colors.textPrimary,
    minHeight: 90,
  },
  sectionLabel: {
    fontFamily: font.bodyBold, fontSize: 12.5,
    color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.4,
    marginBottom: -4,
  },
  chipRow: { gap: 8, paddingBottom: 2 },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  chipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  chipText: {
    fontFamily: font.bodyBold, fontSize: 13.5,
    color: colors.textSecondary,
  },
  chipTextActive: { color: '#fff' },
  budgetRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 14,
  },
  budgetLabel: {
    fontFamily: font.bodySemi, fontSize: 13.5,
    color: colors.textSecondary,
  },
  budgetInput: {
    fontFamily: font.bodyBold, fontSize: 15,
    color: colors.textPrimary, textAlign: 'right',
    minWidth: 100,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 17,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontFamily: font.bodyExtra, fontSize: 16, color: '#fff' },
  hint: {
    fontFamily: font.body, fontSize: 12.5,
    color: colors.textMuted, textAlign: 'center', lineHeight: 18,
  },
});
