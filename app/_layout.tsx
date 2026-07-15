import { useEffect, useState, createContext, useContext } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Session } from '@supabase/supabase-js';
import {
  useFonts,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { supabase, SUPABASE_CONFIGURED } from '../lib/supabase';
import { registerPushToken } from '../lib/push';
import { logEvent } from '../lib/events';
import { Profile } from '../lib/types';
import { colors, font } from '../constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Auth context ──────────────────────────────────────────────

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
  blockedIds: Set<string>;
  blockUser: (targetId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  profileLoading: true,
  refreshProfile: async () => {},
  blockedIds: new Set(),
  blockUser: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ── Root layout ───────────────────────────────────────────────

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());

  const fetchProfile = async (userId: string) => {
    setProfileLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ?? null);
    setProfileLoading(false);
  };

  const fetchBlocklist = async (userId: string) => {
    const { data } = await supabase
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (data) setBlockedIds(new Set(data.map((r: any) => r.blocked_id)));
  };

  const blockUser = async (targetId: string) => {
    if (!session?.user) return;
    await supabase.from('user_blocks').insert({
      blocker_id: session.user.id,
      blocked_id: targetId,
    });
    await supabase.from('reports').insert({
      reporter_id: session.user.id,
      target_type: 'user',
      target_id: targetId,
      reason: 'blocked',
    });
    await logEvent('report_filed', { target_type: 'user', target_id: targetId, reason: 'blocked' }, session.user.id);
    setBlockedIds(prev => new Set([...prev, targetId]));
  };

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setSessionLoading(false);
      return;
    }

    // Must be registered before signInAnonymously() so it catches the session event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session?.user) {
          fetchProfile(session.user.id);
          fetchBlocklist(session.user.id);
        } else {
          setProfile(null);
          setBlockedIds(new Set());
        }
      },
    );

    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (existing) {
        setSession(existing);
        if (existing.user) {
          fetchProfile(existing.user.id);
          fetchBlocklist(existing.user.id);
        }
      } else {
        // TODO(kworva): upgrade anon → verified via phone OTP, link to same profile id
        await supabase.auth.signInAnonymously();
        // onAuthStateChange above fires and sets the session
      }
      setSessionLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user && profile) {
      registerPushToken(session.user.id);
    }
  }, [session?.user?.id, profile?.id]);

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  // Fonts failed — still render the app, just without custom fonts
  const ready = (fontsLoaded || !!fontError) && !sessionLoading;

  if (!ready) {
    return (
      <View style={S.splash}>
        <Text style={S.splashWord}>kworva</Text>
        <ActivityIndicator color="#fff" size="large" style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (!SUPABASE_CONFIGURED) {
    return (
      <View style={S.setup}>
        <Text style={S.setupTitle}>Supabase not configured</Text>
        <Text style={S.setupBody}>
          Create a <Text style={S.setupCode}>.env</Text> file in the project root:
        </Text>
        <View style={S.setupBox}>
          <Text style={S.setupCode}>EXPO_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key</Text>
        </View>
        <Text style={S.setupBody}>
          Then restart Metro with <Text style={S.setupCode}>npx expo start --clear</Text>
        </Text>
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ session, profile, profileLoading, refreshProfile, blockedIds, blockUser }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="consent" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="policy" />
        <Stack.Screen name="feedback" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="composer"
          options={{
            presentation: 'modal',
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
        <Stack.Screen name="request/[id]" />
        <Stack.Screen name="chat/[id]" />
      </Stack>
    </AuthContext.Provider>
  );
}

const S = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashWord: {
    fontSize: 42,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: -2,
  },
  setup: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  setupTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  setupBody: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  setupBox: {
    backgroundColor: colors.muted,
    borderRadius: 12,
    padding: 16,
  },
  setupCode: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: colors.textPrimary,
  },
});
