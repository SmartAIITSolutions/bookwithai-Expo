import { ColorValue, StyleSheet, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';

// Shared with (tabs)/_layout.tsx so any screen can render the exact same
// tab-bar icon treatment (active glow ring + dot) outside the tab bar itself
// -- e.g. My Salons' "Add Salon" button reusing the vanished Find Salon icon.
export const TAB_ICON_COLORS = {
  gold: '#F4D77A',
  purple: '#8B5CFF',
  white: '#FFFFFF',
  inactive: 'rgba(255,255,255,0.72)',
};

export function TabIcon({
  Icon,
  color,
  size,
  focused,
}: {
  Icon: LucideIcon;
  color: ColorValue;
  size: number;
  focused: boolean;
}) {
  return (
    <View style={styles.iconSlot}>
      {focused && (
        <>
          <View style={styles.activeGlowOuter} />
          <View style={styles.activeGlowInner} />
        </>
      )}

      <Icon
        size={focused ? size + 1 : size}
        color={color as string}
        strokeWidth={focused ? 2 : 1.7}
      />

      {focused && <View style={styles.activeDot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  iconSlot: {
    width: 42,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeGlowOuter: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(139,92,255,0.16)',
    shadowColor: TAB_ICON_COLORS.purple,
    shadowOpacity: 0.56,
    shadowRadius: 13,
    shadowOffset: { width: 0, height: 0 },
  },

  activeGlowInner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(244,215,122,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(244,215,122,0.14)',
  },

  activeDot: {
    position: 'absolute',
    bottom: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: TAB_ICON_COLORS.gold,
    shadowColor: TAB_ICON_COLORS.gold,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
});
