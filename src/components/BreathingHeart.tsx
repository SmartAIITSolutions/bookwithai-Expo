import { useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// App-wide replacement for the plain ActivityIndicator spinner -- a small
// breathing heart, used both for full-screen loading states and inline
// button spinners (e.g. "Saving...", "Cancelling...").
export function BreathingHeart({ size = 44, color = '#F4D77A' }: { size?: number; color?: string }) {
  const breatheVal = useSharedValue(0);
  useEffect(() => {
    breatheVal.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breatheVal]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breatheVal.value * 0.25 }],
  }));
  return (
    <Reanimated.View style={style}>
      <Ionicons name="heart" size={size} color={color} />
    </Reanimated.View>
  );
}
