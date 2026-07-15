import { useEffect } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { GoldSparkles } from '@/components/onboarding/GoldSparkle';

const { width, height } = Dimensions.get('window');

interface SplashOverlayProps {
  onDone: () => void;
}

export function SplashOverlay({ onDone }: SplashOverlayProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 600 }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, 1600);
    return () => clearTimeout(timer);
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
      <View style={styles.center}>
        <Image
          source={require('@/assets/images/bwa-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.sparkleRow}>
          <GoldSparkles />
        </View>
        <Text style={styles.tagline}>Beauty Booking. Made Beautiful.</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  center: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 22,
  },
  sparkleRow: {
    marginVertical: Spacing.sm,
  },
  tagline: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    letterSpacing: 0.4,
  },
});
