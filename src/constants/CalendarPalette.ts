// Exact palette from the "Calendar Screen — Colors" design spec (2026-07-21).
// Scoped to the owner Calendar screen and its view-mode components for now.
export const CalendarPalette = {
  background: '#0B0712',
  surface: '#130F1F',
  card: '#1A1626',
  elevatedSurface: '#221D33',
  border: '#2E2942',

  textPrimary: '#F7F7FB',
  textSecondary: '#B8B3C7',
  textDisabled: '#6C6680',

  primaryPurple: '#6B3DFF',
  secondaryPurple: '#9D6CFF',
  accentGold: '#FFC857',
  darkGold: '#DAA520',
  lightGold: '#FFE7A3',
  highlightPurple: '#C084FC',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  confirmed: '#7C3AED',
  openSlot: '#FBBF24',
} as const;
