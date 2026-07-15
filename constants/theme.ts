export const colors = {
  // Brand
  primary: '#0B6E4F',
  primaryLight: '#E6F0E9',
  primaryMid: '#CDE9DA',

  // Accent
  accent: '#FF6A3D',

  // Background / surfaces
  bg: '#F7F4ED',
  surface: '#E9E3D6',
  card: '#FFFFFF',
  muted: '#F0EBDF',

  // Text
  textPrimary: '#1A1714',
  textSecondary: '#7A7064',
  textMuted: '#A89E8C',
  textLight: '#C9C0B0',

  // Borders
  border: '#ECE6DA',
  borderInput: '#E0D9CB',

  // Nav
  navInactive: '#9A9180',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
} as const;

export const font = {
  heading: 'BricolageGrotesque_800ExtraBold',
  body: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyExtra: 'PlusJakartaSans_800ExtraBold',
} as const;
