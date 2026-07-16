// Book With AI — Customer App
// Color Palette — Single source of truth

export const Colors = {
  // ── Primary ──────────────────────────────────────────
  primary: '#5B2EFF',
  primaryDark: '#4720D8',

  // ── Accent (Gold) ────────────────────────────────────
  gold: '#D4AF37',
  goldSoft: '#E7C96A',

  // ── Backgrounds ──────────────────────────────────────
  backgroundMain: '#FFFFFF',
  backgroundSection: '#F7F3FF',
  backgroundLavender: '#F7F3FF',

  // ── Surfaces ─────────────────────────────────────────
  white: '#FFFFFF',
  card: '#FFFFFF',

  // ── Text ─────────────────────────────────────────────
  textPrimary: '#222222',
  textSecondary: '#666666',
  textDisabled: '#999999',
  textOnPrimary: '#FFFFFF',

  // ── Borders ──────────────────────────────────────────
  border: '#E8E3F5',

  // ── Bottom Navigation ────────────────────────────────
  navBackground: '#FFFFFF',
  navSelected: '#5B2EFF',
  navUnselected: '#9CA3AF',

  // ── Buttons ──────────────────────────────────────────
  buttonPrimaryBg: '#5B2EFF',
  buttonPrimaryText: '#FFFFFF',
  buttonSecondaryBg: '#FFFFFF',
  buttonSecondaryBorder: '#5B2EFF',
  buttonSecondaryText: '#5B2EFF',
  buttonDisabledBg: '#ECECEC',
  buttonDisabledText: '#999999',

  // ── Status ───────────────────────────────────────────
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // ── Gradients (use sparingly — hero sections, badges, loyalty, gift cards) ──
  gradientPrimaryStart: '#6A3DFF',
  gradientPrimaryEnd: '#5B2EFF',
  gradientLuxuryStart: '#FFFFFF',
  gradientLuxuryEnd: '#F7F3FF',
  gradientGoldStart: '#E7C96A',
  gradientGoldEnd: '#D4AF37',

  // ── Shadow ───────────────────────────────────────────
  shadowColor: 'rgba(34, 34, 34, 0.08)',
} as const;

export type ColorKey = keyof typeof Colors;
