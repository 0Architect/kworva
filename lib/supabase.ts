import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://eyxwcmfoakjmktirwybg.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_32UUe8hwsSISrtUCZZwdIA_yvRfPPlD';

// True when the app runs without a .env file (dev convenience check).
export const SUPABASE_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// SecureStore has a 2048-char limit per key; Supabase JWTs can exceed that.
const CHUNK_SIZE = 2000;

const storage = {
  async getItem(key: string): Promise<string | null> {
    const chunkStr = await SecureStore.getItemAsync(`${key}.__chunks`);
    if (!chunkStr) return SecureStore.getItemAsync(key);
    const count = parseInt(chunkStr, 10);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.__chunks`, String(count));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}.${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const chunkStr = await SecureStore.getItemAsync(`${key}.__chunks`);
    if (!chunkStr) {
      await SecureStore.deleteItemAsync(key);
      return;
    }
    const count = parseInt(chunkStr, 10);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
    await SecureStore.deleteItemAsync(`${key}.__chunks`);
  },
};

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder',
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
