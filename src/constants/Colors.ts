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
  // App-wide standard as of 2026-07: every screen's base is a light
  // lavender wash (not white), with white cards/surfaces on top for
  // contrast. backgroundSection/backgroundLavender stay paler than this
  // so a "highlighted" card still reads as lighter than the screen base.
  backgroundMain: '#EAE2FF',
  backgroundSection: '#F7F3FF',
  backgroundLavender: '#F7F3FF',

  // ── Surfaces ─────────────────────────────────────────
  white: '#FFFFFF',
  card: '#FFFFFF',

  // ── Text ─────────────────────────────────────────────
  // Pushed to true black (from the original #222222) so text pops clearly
  // against the lavender background instead of the lavender dominating.
  // textDisabled stays muted on purpose -- that's the point of "disabled".
  textPrimary: '#000000',
  textSecondary: '#333333',
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

  // ── Salon-owner app: appointment status colors (Phase 0.3) ───
  // Status only — never used for service or staff identity.
  statusCompleted:      '#9CA3AF', // Gray
  statusCheckedIn:      '#3B82F6', // Blue
  statusInService:      '#5B2EFF', // Purple (reuses primary)
  statusPaid:           '#22C55E', // Green
  statusArrivingSoon:   '#D4AF37', // Amber (reuses gold)
  statusLate:           '#EF4444', // Red
  statusPaymentPending: '#F97316', // Orange
} as const;

export type ColorKey = keyof typeof Colors;
