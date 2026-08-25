import { StyleSheet, View } from 'react-native';
import { SanaaMark } from '@/components/SanaaMark';

// SANAA's bottom-nav slot -- deliberately NOT wrapped in NavIcon's glow
// ring. SanaaMark's own active/inactive artwork (soft silhouette vs.
// gold-ringed badge) already encodes state, matching this app's other
// dimensional-purple/gold treatment without stacking a second glow on top
// of illustrated art, which would read as visual clutter rather than
// "clearly active." Kept the same 42x34 slot as NavIcon so all five tab
// items align identically in the bar.
export function SanaaNavTabIcon({ focused, badge }: { focused: boolean; badge?: boolean }) {
  return (
    <View style={styles.slot}>
      <SanaaMark variant="navigation" active={focused} size={focused ? 29 : 26} />
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
  attentionBadge: {
    position: 'absolute',
    top: 0,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#09000F',
  },
});
