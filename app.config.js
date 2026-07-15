const base = require('./app.json');

module.exports = {
  ...base,
  expo: {
    ...base.expo,
    extra: {
      ...base.expo.extra,
      // These are publishable keys — safe to embed in client builds.
      // In dev, they're overridden by .env via Expo's default loading.
      EXPO_PUBLIC_SUPABASE_URL:
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        'https://eyxwcmfoakjmktirwybg.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        'sb_publishable_32UUe8hwsSISrtUCZZwdIA_yvRfPPlD',
    },
  },
};
