import { Image, StyleSheet, View, ViewStyle } from 'react-native';

// The one reusable SANAA brand-identity asset. SANAA is a product/agent, not
// a generic navigation category, so she gets real illustrated artwork
// (approved visual: purple/silver AI receptionist, headset, gold signature
// sparkle) rather than an icon-font glyph like every other nav item --
// while still sharing this app's purple/gold treatment so she reads as part
// of the same family, not a mismatched sticker.
//
// Every SANAA-branded surface in the app must render through this
// component -- never re-import the raw asset files directly -- so the
// identity stays visually identical everywhere it appears (nav tab,
// booking attribution, avatar-sized contexts).
const SANAA_INACTIVE = require('../../assets/images/sanaa/sanaa-mark-inactive.png');
const SANAA_ACTIVE = require('../../assets/images/sanaa/sanaa-mark-active.png');
const SANAA_BADGE = require('../../assets/images/sanaa/sanaa-mark-badge.png');

export type SanaaMarkVariant = 'navigation' | 'bookingAttribution' | 'avatar';

const DEFAULT_SIZE: Record<SanaaMarkVariant, number> = {
  navigation: 26,
  bookingAttribution: 18,
  avatar: 40,
};

export interface SanaaMarkProps {
  /** 'navigation' -- bottom tab (needs active/inactive artwork).
   *  'bookingAttribution' -- small inline mark next to a booking's
   *  price/metadata, meaning "booked by SANAA." Stays identifiable down to
   *  ~16px (SANAA-P0/P1-SPEC's 20-28px legibility requirement).
   *  'avatar' -- larger standalone use (e.g. a settings/profile context). */
  variant?: SanaaMarkVariant;
  /** Only meaningful for variant='navigation' -- selects the gold-ringed
   *  active artwork vs. the softer inactive silhouette. Ignored otherwise;
   *  bookingAttribution/avatar always render the same circular badge mark,
   *  since a booking's attribution is a fact, not a toggled UI state. */
  active?: boolean;
  /** Square render size in px. Defaults per-variant if omitted. */
  size?: number;
  style?: ViewStyle;
}

export function SanaaMark({ variant = 'avatar', active = false, size, style }: SanaaMarkProps) {
  const resolvedSize = size ?? DEFAULT_SIZE[variant];
  const source = variant === 'navigation' ? (active ? SANAA_ACTIVE : SANAA_INACTIVE) : SANAA_BADGE;

  return (
    <View style={[styles.wrap, { width: resolvedSize, height: resolvedSize }, style]}>
      <Image
        source={source}
        style={{ width: resolvedSize, height: resolvedSize }}
        resizeMode="contain"
        accessibilityLabel="SANAA"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
