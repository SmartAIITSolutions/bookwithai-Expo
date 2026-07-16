// Book With AI — Customer App
// Spacing — 8px base grid
// Plenty of whitespace is a design rule

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,   // cards — design rule
  xl: 20,
  full: 9999, // pill buttons, avatars
} as const;

export const Layout = {
  screenPaddingH: 20,   // horizontal padding for all screens
  screenPaddingV: 24,   // vertical padding for all screens
  cardPadding: 20,
  sectionGap: 32,
  itemGap: 12,
} as const;
