import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/events';
import { useAuth } from './_layout';
import { colors, font, spacing, radius } from '../constants/theme';

const CATEGORIES = [
  { key: 'general', label: 'General feedback' },
  { key: 'bug', label: 'Bug or something broken' },
  { key: 'safety', label: 'Safety concern' },
  { key: 'suggestion', label: 'Suggestion or feature idea' },
  { key: 'other', label: 'Other' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [category, setCategory] = useState<Category>('general');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = body.trim().length >= 5 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    const { error } = await supabase.from('feedback').insert({
      user_id: session?.user?.id ?? null,
      category,
      body: body.trim(),
    });

    if (error) {
      setSubmitting(false);
      Alert.alert('Could not send', error.message);
      return;
    }

    await logEvent('feedback_submitted', { category }, session?.user?.id);
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <View style={[styles.root, styles.doneRoot]}>
        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Feedback</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.doneContent}>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.doneTitle}>Thanks for that.</Text>
          <Text style={styles.doneSub}>
            We read every message. If you flagged something broken or unsafe we'll look into it.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Back to app</Text>
          </TouchableOpacity>
        </View>
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
        <Text style={styles.topTitle}>Feedback</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>What kind of feedback?</Text>
        <View style={styles.catList}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.key}
              style={[styles.catRow, category === c.key && styles.catRowActive]}
              onPress={() => setCategory(c.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.radio, category === c.key && styles.radioActive]}>
                {category === c.key && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.catText, category === c.key && styles.catTextActive]}>
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Your message *</Text>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Tell us what you saw, what happened, or what you'd like to see…"
          placeholderTextColor={colors.textMuted}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          editable={!submitting}
        />

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.submitBtnText}>Send feedback</Text>}
        </TouchableOpacity>

        <Text style={styles.note}>
          Anonymous. We read everything but can't always reply individually.
        </Text>

        <View style={{ height: 40 }} />
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
    backgroundColor: colors.bg,
  },
  backBtn: { width: 60 },
  backText: { fontFamily: font.bodySemi, fontSize: 14, color: colors.primary },
  topTitle: { fontFamily: font.heading, fontSize: 18, color: colors.textPrimary, letterSpacing: -0.2 },

  scroll: { padding: spacing.lg },

  label: {
    fontFamily: font.bodyBold, fontSize: 12,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4,
    marginBottom: 10,
  },

  catList: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, overflow: 'hidden',
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.md, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  catRowActive: { backgroundColor: colors.primaryLight },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  catText: { fontFamily: font.bodySemi, fontSize: 14.5, color: colors.textSecondary },
  catTextActive: { fontFamily: font.bodyBold, color: colors.primary },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg, padding: spacing.md,
    fontFamily: font.body, fontSize: 15, color: colors.textPrimary,
    minHeight: 130,
    marginBottom: spacing.lg,
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 17, alignItems: 'center',
    marginBottom: 12,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontFamily: font.bodyExtra, fontSize: 15, color: '#fff' },

  note: {
    fontFamily: font.body, fontSize: 12.5,
    color: colors.textMuted, textAlign: 'center',
  },

  doneRoot: {},
  doneContent: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 14,
  },
  doneIcon: {
    fontSize: 48, lineHeight: 60,
    backgroundColor: colors.primaryLight,
    width: 80, height: 80, borderRadius: 24,
    textAlign: 'center',
    color: colors.primary,
    fontWeight: '800',
  },
  doneTitle: { fontFamily: font.heading, fontSize: 24, color: colors.textPrimary, letterSpacing: -0.5 },
  doneSub: {
    fontFamily: font.body, fontSize: 14.5,
    color: colors.textSecondary, lineHeight: 22, textAlign: 'center',
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 15, paddingHorizontal: 32,
    marginTop: 12,
  },
  doneBtnText: { fontFamily: font.bodyExtra, fontSize: 15, color: '#fff' },
});
