import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export async function registerPushToken(userId: string): Promise<void> {
  const log = (status: string, extra?: Record<string, unknown>) =>
    supabase.from('events').insert({ user_id: userId, type: 'push_debug', payload: { status, ...extra } }).then(() => {});

  try {
    if (!Device.isDevice) { await log('not_device'); return; }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') { await log('permission_denied', { finalStatus }); return; }

    const tokenResult = await Notifications.getExpoPushTokenAsync({
      projectId: 'cbbc64ad-f2b9-4a18-8f30-1db13342b91b',
    });

    const token = tokenResult?.data;
    if (!token) { await log('no_token'); return; }

    const { error } = await supabase.from('expo_push_tokens').upsert(
      { user_id: userId, token },
      { onConflict: 'user_id,token' },
    );

    await log(error ? 'upsert_failed' : 'ok', { token: token.slice(-8), error: error?.message });
  } catch (err: any) {
    await log('exception', { error: err?.message ?? String(err) }).catch(() => {});
  }
}
