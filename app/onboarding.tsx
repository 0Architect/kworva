import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { logEvent } from '../lib/events';
import { useAuth } from './_layout';
import { colors, spacing, radius, font } from '../constants/theme';

export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [campus, setCampus] = useState('');
  const [area, setArea] = useState('');
  const [bioText, setBioText] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    displayName.trim().length >= 2 &&
    phone.trim().length >= 7 &&
    campus.trim().length >= 2 &&
    area.trim().length >= 2;

  const handleSubmit = async () => {
    if (!session?.user) return;

    setLoading(true);
    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      display_name: displayName.trim(),
      phone: phone.trim(),
      campus: campus.trim(),
      area: area.trim(),
      bio_text: bioText.trim() || null,
      consent_at: new Date().toISOString(),
      policy_version: '1.0',
    });

    if (error) {
      setLoading(false);
      Alert.alert('Could not save your profile', error.message);
      return;
    }

    await logEvent('profile_updated', {
      context: 'onboarding',
      has_bio: !!bioText.trim(),
    }, session.user.id);

    await refreshProfile();
    setLoading(false);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.wordmark}>kworva</Text>
          <Text style={styles.title}>Set up your profile</Text>
          <Text style={styles.sub}>
            This is how plugs and buyers will see you. You can update it anytime.
          </Text>
        </View>

        <View style={styles.form}>
          {/* Display name */}
          <View style={styles.field}>
            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How should people call you?"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Phone number *</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. 08012345678"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              editable={!loading}
            />
            <Text style={styles.bioHint}>
              So plugs can reach you. Not shown publicly — only shared when you connect.
            </Text>
          </View>

          {/* Campus */}
          <View style={styles.field}>
            <Text style={styles.label}>Your school *</Text>
            <TextInput
              style={styles.input}
              value={campus}
              onChangeText={setCampus}
              placeholder="e.g. Unilag, LASU, UI, OAU…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>

          {/* Area */}
          <View style={styles.field}>
            <Text style={styles.label}>Where are you usually around? *</Text>
            <TextInput
              style={styles.input}
              value={area}
              onChangeText={setArea}
              placeholder="e.g. Jaja Hall, Block C, Faculty"
              placeholderTextColor={colors.textMuted}
              editable={!loading}
            />
          </View>

          {/* Bio */}
          <View style={styles.field}>
            <Text style={styles.label}>What do you do / have? (optional)</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={bioText}
              onChangeText={setBioText}
              placeholder="e.g. I make food, fix phones, do errands. I usually have phone accessories and snacks."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              editable={!loading}
            />
            <Text style={styles.bioHint}>
              This helps Kworva match you to relevant requests. Not shown publicly as a listing.
            </Text>
          </View>

        </View>

        <TouchableOpacity
          style={[styles.btn, (!canSubmit || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>Enter campus →</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 48,
    gap: spacing.xl,
  },
  header: { gap: 8, paddingTop: spacing.xl },
  wordmark: {
    fontFamily: font.heading,
    fontSize: 26,
    color: colors.primary,
    letterSpacing: -1,
  },
  title: {
    fontFamily: font.heading,
    fontSize: 26,
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  sub: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  form: { gap: spacing.md },
  field: { gap: 6 },
  label: {
    fontFamily: font.bodyBold,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderInput,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: 15,
    fontFamily: font.body,
    fontSize: 15.5,
    color: colors.textPrimary,
  },
  textarea: {
    minHeight: 90,
    textAlignVertical: 'top',
    paddingTop: 15,
  },
  bioHint: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnText: {
    fontFamily: font.bodyExtra,
    fontSize: 16,
    color: '#fff',
  },
});
