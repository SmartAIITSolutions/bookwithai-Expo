import { RefreshControl, RefreshControlProps, View, StyleSheet } from 'react-native';
import { BreathingHeart } from './BreathingHeart';

// RefreshControl has to remain a literal <RefreshControl> element -- React
// Native clones it internally to wire up the native pull gesture, so it
// can't be swapped for an arbitrary custom component. Instead we make its
// own spinner fully transparent and layer a BreathingHeart on top, shown
// only once `refreshing` flips true (right as the native gesture releases).
// Same correct native pull-gesture feel/threshold, custom heart visual
// instead of the OS spinner.
export function InvisibleRefreshControl({ refreshing, onRefresh }: Pick<RefreshControlProps, 'refreshing' | 'onRefresh'>) {
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="transparent"
      colors={['transparent']}
      progressBackgroundColor="transparent"
    />
  );
}

export function RefreshHeartOverlay({ refreshing }: { refreshing: boolean }) {
  if (!refreshing) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <BreathingHeart size={28} color="#F4D77A" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
});
