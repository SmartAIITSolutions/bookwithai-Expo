import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { GoldSparkles } from './GoldSparkle';

const { width } = Dimensions.get('window');

interface Slide4FinalProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function Slide4Final({ onGetStarted, onSignIn }: Slide4FinalProps) {
  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 3000 }),
        withTiming(1.0, { duration: 3000 })
      ),
      -1,
      true
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: 0.18,
  }));

  return (
    <View style={styles.slide}>
      {/* Logo + glow */}
      <View style={styles.logoWrapper}>
        <Animated.View style={[styles.glow, glowStyle]} />
        <Image
          source={require('@/assets/images/bwa-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.sparkleRow}>
          <GoldSparkles />
        </View>
      </View>

      {/* Text */}
      <Animated.View entering={FadeIn.duration(700).delay(200)} style={styles.textBlock}>
        <Text style={styles.headline}>Your Beauty Journey{'\n'}Starts Here.</Text>
        <Text style={styles.subtext}>
          Create your free account and start booking with confidence.
        </Text>
      </Animated.View>

      {/* Buttons */}
      <Animated.View entering={FadeIn.duration(700).delay(400)} style={styles.buttons}>
        <Text style={styles.primaryButton} onPress={onGetStarted}>
          Get Started
        </Text>
        <Text style={styles.secondaryButton} onPress={onSignIn}>
          Sign In
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: {
    width,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundMain,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  sparkleRow: {
    marginTop: Spacing.sm,
  },
  textBlock: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  headline: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 34,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 34 * 1.2,
  },
  subtext: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.7,
  },
  buttons: {
    width: '100%',
    gap: Spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  secondaryButton: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.base,
    color: Colors.primary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
