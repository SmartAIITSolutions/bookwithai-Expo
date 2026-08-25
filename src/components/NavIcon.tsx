import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IconTheme } from '@/constants/IconTheme';

// "Modern Filled" bottom-nav icon family for the owner app (Option 4,
// locked design direction) -- replaces the previous thin-outline Lucide
// icons, which read as generic/mismatched against SANAA's illustrated
// brand mark. Ionicons' filled glyphs already have the soft, rounded,
// dimensional look the direction calls for; this wrapper supplies the
// consistent inactive/active color and glow treatment on top, matching
// SanaaMark's active state visually (purple + restrained gold) so the
// whole tab bar reads as one family.
//
// Deliberately a SEPARATE component from TabIcon (kept untouched) --
// TabIcon is shared with the customer app's tab bar ((tabs)/_layout.tsx)
// and my-salons.tsx, both out of scope for this owner-app-only pass.
export function NavIcon({
  name,
  focused,
  size = 24,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  size?: number;
  /** Real-condition attention indicator only -- never decorative. */
  badge?: boolean;
}) {
  return (
    <View style={styles.slot}>
      {focused && (
        <>
          <View style={styles.glowOuter} />
          <View style={styles.glowInner} />
        </>
      )}

      <Ionicons
        name={name}
        size={focused ? size + 1 : size}
        color={focused ? IconTheme.purpleLight : IconTheme.inactive}
      />

      {focused && <View style={styles.activeDot} />}
      {badge && <View style={styles.attentionBadge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 42,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(124,58,237,0.18)',
    shadowColor: IconTheme.purple,
    shadowOpacity: 0.56,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },
  glowInner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244,196,48,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(244,196,48,0.16)',
  },
  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: IconTheme.gold,
    shadowColor: IconTheme.gold,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  attentionBadge: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#09000F',
  },
});
