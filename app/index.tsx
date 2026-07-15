import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from './_layout';
import { colors } from '../constants/theme';

export default function Index() {
  const { session, profile, profileLoading } = useAuth();

  if (!session || profileLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Profile exists and consent is recorded → main app
  if (profile?.consent_at) return <Redirect href="/(tabs)" />;

  // Profile exists but no consent yet (existing users upgrading to this build)
  if (profile) return <Redirect href="/consent?mode=existing" />;

  // No profile → show consent first, then onboarding
  return <Redirect href="/consent?mode=new" />;
}
