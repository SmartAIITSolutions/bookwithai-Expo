// Book With AI — Owner App icon system palette.
// Single source of truth for the "Modern Filled" icon treatment locked for
// the owner app (dark luxury: black/deep-purple foundation, dimensional
// purple accents, restrained gold highlights). Reused by NavIcon and any
// future AppIcon-family components so every icon reads as one family
// instead of ad-hoc per-screen colors.
export const IconTheme = {
  purple: '#7C3AED',
  purpleLight: '#A855F7',
  gold: '#F4C430',
  pearl: '#F8FAFF',
  // Inactive icons use a soft, low-opacity pearl/lavender fill -- never
  // pure white at full opacity, which would compete with active items.
  inactive: 'rgba(248,250,255,0.62)',
};
