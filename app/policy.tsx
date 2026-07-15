import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, spacing, radius } from '../constants/theme';

export default function PolicyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.topTitle}>Policy &amp; Rules</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h1}>Privacy Policy &amp;{'\n'}Community Rules</Text>
        <Text style={styles.updated}>Version 1.0 · July 2026</Text>

        <Section title="What data we collect">
          <Bullet text="Name — visible to all users." />
          <Bullet text="Campus and area — used for matching; visible to all users." />
          <Bullet text="Posts and offers — visible while open." />
          <Bullet text="Phone number — optional; not shown publicly; only shared in chats you initiate." />
          <Bullet text="Device session — an anonymous ID created on install. Uninstalling the app removes it." />
          <Bullet text={'Usage events — anonymised actions (e.g. "request posted"). No message content.'} />
        </Section>

        <Section title="How we use it">
          <Bullet text="To match requests to nearby plugs." />
          <Bullet text="To send push notifications to matched plugs." />
          <Bullet text="To improve the app using aggregate patterns." />
          <Bullet text="To investigate safety reports." />
        </Section>

        <Section title="Who can see what">
          <Bullet text="All users: your name, campus, area, open requests." />
          <Bullet text="Chat participants only: messages in a chat." />
          <Bullet text="Only you: your phone number (until shared in a chat)." />
        </Section>

        <Section title="Community Rules">
          <Text style={styles.body}>
            Kworva is for legitimate campus help. The following are prohibited and will result in removal:
          </Text>
          <Bullet bold text="Exam malpractice — selling leaked questions, answers, or impersonation services (WAEC, NECO, JAMB, university exams)." />
          <Bullet bold text="Fraud and scams — Ponzi schemes, fake investments, impersonation." />
          <Bullet bold text="Forged credentials — fake certificates, ID cards, or transcripts." />
          <Bullet bold text="Prohibited substances — illegal drugs or controlled substances." />
          <Bullet bold text="Sexual services — soliciting or offering sexual services of any kind." />
          <Bullet bold text="Harassment and abuse — threatening or bullying other users." />
          <Bullet bold text="Harmful content — violent, discriminatory, or endangering content." />
        </Section>

        <Section title="Your rights (NDPA)">
          <Text style={styles.body}>
            Under the Nigeria Data Protection Act 2023, you have the right to access, correct, and request deletion of your data. Contact us at hello@kworva.app.
          </Text>
        </Section>

        <Section title="Third-party services">
          <Bullet text="Supabase — database and authentication." />
          <Bullet text="Expo — push notification delivery." />
          <Text style={[styles.body, { marginTop: 8 }]}>We do not sell your data.</Text>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.wrap}>
      <Text style={sectionStyles.title}>{title}</Text>
      {children}
    </View>
  );
}

function Bullet({ text, bold }: { text: string; bold?: boolean }) {
  return (
    <View style={sectionStyles.bulletRow}>
      <Text style={sectionStyles.dot}>·</Text>
      <Text style={[sectionStyles.bulletText, bold && sectionStyles.boldText]}>{text}</Text>
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
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn: { width: 60 },
  backText: { fontFamily: font.bodySemi, fontSize: 14, color: colors.primary },
  topTitle: { fontFamily: font.heading, fontSize: 18, color: colors.textPrimary, letterSpacing: -0.2 },

  scroll: { padding: spacing.lg },

  h1: {
    fontFamily: font.heading, fontSize: 28,
    color: colors.textPrimary, letterSpacing: -1, lineHeight: 34,
    marginBottom: 6,
  },
  updated: {
    fontFamily: font.bodySemi, fontSize: 12.5,
    color: colors.textMuted, marginBottom: 28,
  },
  body: {
    fontFamily: font.body, fontSize: 14,
    color: colors.textSecondary, lineHeight: 21,
  },
});

const sectionStyles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.md,
    gap: 8,
  },
  title: {
    fontFamily: font.bodyExtra, fontSize: 13,
    color: colors.primary, letterSpacing: -0.1,
    marginBottom: 2,
  },
  bulletRow: { flexDirection: 'row', gap: 8 },
  dot: { fontFamily: font.bodyBold, fontSize: 14, color: colors.primary, lineHeight: 21 },
  bulletText: { fontFamily: font.body, fontSize: 14, color: colors.textSecondary, lineHeight: 21, flex: 1 },
  boldText: { fontFamily: font.bodyBold, color: colors.textPrimary },
});
