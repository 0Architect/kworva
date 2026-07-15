import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/events';
import { useAuth } from './_layout';
import { colors, font, spacing, radius } from '../constants/theme';

export const POLICY_VERSION = '1.0';

export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();
  // mode=new → no profile yet, go to onboarding after agree
  // mode=existing → profile exists but no consent_at, update and go to tabs
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAgree = async () => {
    if (!agreed || !session?.user) return;
    setSaving(true);

    const now = new Date().toISOString();

    if (mode === 'existing' && profile) {
      // Update existing profile with consent
      await supabase
        .from('profiles')
        .update({ consent_at: now, policy_version: POLICY_VERSION })
        .eq('id', session.user.id);
      await refreshProfile();
    }

    await logEvent('consent_given', { policy_version: POLICY_VERSION, mode: mode ?? 'new' }, session.user.id);
    setSaving(false);

    if (mode === 'existing') {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom + 16 }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.wordmark}>kworva</Text>
        <Text style={styles.title}>Before you start</Text>
        <Text style={styles.sub}>
          Kworva connects students on campus. Here is what we collect and how we use it — and the rules everyone agrees to.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What we collect</Text>
          <Item text="Your name, campus, and area — so others can find you." />
          <Item text="Your posts and offers — visible to campus users while open." />
          <Item text="Your phone number — optional; only shared in chats." />
          <Item text="An anonymous device session — how you stay logged in." />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>How it is used</Text>
          <Item text="To match your needs to plugs who can help." />
          <Item text="To notify matched plugs about your request." />
          <Item text="To keep the platform safe (we review reports)." />
        </View>

        <View style={[styles.card, styles.rulesCard]}>
          <Text style={[styles.cardTitle, styles.rulesTitleText]}>Community Rules — strictly prohibited</Text>
          <Item accent text="Exam malpractice or leaked answers" />
          <Item accent text="Fraud, scams, or fake credentials" />
          <Item accent text="Illegal drugs or controlled substances" />
          <Item accent text="Sexual services of any kind" />
          <Item accent text="Harassment or harmful content" />
        </View>

        <TouchableOpacity
          style={styles.policyLink}
          onPress={() => router.push('/policy')}
          activeOpacity={0.7}
        >
          <Text style={styles.policyLinkText}>Read the full Privacy Policy &amp; Community Rules →</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setAgreed(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkText}>
            I have read and agree to the Privacy Policy and Community Rules. I understand that violations will result in removal from the platform.
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.agreeBtn, (!agreed || saving) && styles.agreeBtnDisabled]}
          onPress={handleAgree}
          disabled={!agreed || saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.agreeBtnText}>
                {mode === 'existing' ? 'I agree — continue' : 'I agree — set up my profile'}
              </Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Item({ text, accent }: { text: string; accent?: boolean }) {
  return (
    <View style={itemStyles.row}>
      <Text style={[itemStyles.dot, accent && itemStyles.accentDot]}>{accent ? '✕' : '·'}</Text>
      <Text style={[itemStyles.text, accent && itemStyles.accentText]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md },

  wordmark: {
    fontFamily: font.heading, fontSize: 26,
    color: colors.primary, letterSpacing: -1,
  },
  title: {
    fontFamily: font.heading, fontSize: 28,
    color: colors.textPrimary, letterSpacing: -1, lineHeight: 34,
  },
  sub: {
    fontFamily: font.body, fontSize: 14.5,
    color: colors.textSecondary, lineHeight: 22,
  },

  card: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.md,
    gap: 8,
  },
  rulesCard: { backgroundColor: '#FFF6F3', borderColor: '#FDDDD2' },
  cardTitle: {
    fontFamily: font.bodyExtra, fontSize: 13,
    color: colors.primary, letterSpacing: -0.1, marginBottom: 2,
  },
  rulesTitleText: { color: colors.accent },

  policyLink: { alignItems: 'flex-start' },
  policyLinkText: {
    fontFamily: font.bodyBold, fontSize: 13.5,
    color: colors.primary, textDecorationLine: 'underline',
  },

  checkRow: {
    flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    backgroundColor: colors.muted, borderRadius: radius.xl,
    padding: spacing.md,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  checkText: {
    fontFamily: font.body, fontSize: 13.5,
    color: colors.textSecondary, lineHeight: 21, flex: 1,
  },

  footer: {
    paddingHorizontal: spacing.lg, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  agreeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 17, alignItems: 'center',
  },
  agreeBtnDisabled: { opacity: 0.4 },
  agreeBtnText: { fontFamily: font.bodyExtra, fontSize: 16, color: '#fff' },
});

const itemStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  dot: { fontFamily: font.bodyBold, fontSize: 14, color: colors.primary, lineHeight: 21 },
  accentDot: { color: colors.accent, fontSize: 12, marginTop: 2 },
  text: { fontFamily: font.body, fontSize: 14, color: colors.textSecondary, lineHeight: 21, flex: 1 },
  accentText: { fontFamily: font.bodyBold, color: colors.textPrimary },
});
