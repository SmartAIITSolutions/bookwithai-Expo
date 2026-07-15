import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Theme';

interface SparkleProps {
  x: number;
  y: number;
  size: number;
  delay: number;
}

function Sparkle({ x, y, size, delay }: SparkleProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700 }),
          withTiming(0, { duration: 700 })
        ),
        -1,
        false
      )
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 700 }),
          withTiming(0.4, { duration: 700 })
        ),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.sparkle,
        style,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

export function GoldSparkles() {
  const sparkles = [
    { x: -24, y: 8, size: 6, delay: 0 },
    { x: 20, y: -4, size: 4, delay: 400 },
    { x: -8, y: 20, size: 5, delay: 800 },
  ];

  return (
    <View style={styles.container}>
      {sparkles.map((s, i) => (
        <Sparkle key={i} {...s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 48,
    height: 48,
    position: 'relative',
  },
  sparkle: {
    position: 'absolute',
    backgroundColor: Colors.gold,
  },
});
