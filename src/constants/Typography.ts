// Book With AI — Customer App
// Typography — Sora (body/UI) + Fraunces (display/headings)

export const FontFamily = {
  // Body, UI, labels, buttons
  soraLight: 'Sora_300Light',
  sora: 'Sora_400Regular',
  soraMedium: 'Sora_500Medium',
  soraSemiBold: 'Sora_600SemiBold',
  soraBold: 'Sora_700Bold',

  // Display headings, hero text, premium moments
  fraunces: 'Fraunces_400Regular',
  frauncesItalic: 'Fraunces_400Regular_Italic',
  frauncesSemiBold: 'Fraunces_600SemiBold',
  frauncesBold: 'Fraunces_700Bold',
} as const;

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 19,
  xl: 22,
  '2xl': 26,
  '3xl': 30,
  '4xl': 36,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

export const LetterSpacing = {
  tight: -0.3,
  normal: 0,
  wide: 0.4,
  wider: 0.8,
} as const;
