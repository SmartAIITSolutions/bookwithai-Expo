import { View, Text, StyleSheet, Dimensions, Image, ImageSourcePropType } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';

const { width, height } = Dimensions.get('window');

interface OnboardingSlideProps {
  headline: string;
  subtext: string;
  heroImage: ImageSourcePropType | null;
  heroPlaceholderLabel?: string;
  isActive: boolean;
}

export function OnboardingSlide({
  headline,
  subtext,
  heroImage,
  heroPlaceholderLabel,
  isActive,
}: OnboardingSlideProps) {
  const floatValue = useSharedValue(0);
  const scaleValue = useSharedValue(1);

  useEffect(() => {
    if (isActive) {
      floatValue.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 2800 }),
          withTiming(0, { duration: 2800 })
        ),
        -1,
        true
      );
      scaleValue.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 3200 }),
          withTiming(1.0, { duration: 3200 })
        ),
        -1,
        true
      );
    }
  }, [isActive]);

  const heroAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatValue.value },
      { scale: scaleValue.value },
    ],
  }));

  return (
    <View style={styles.slide}>
      {/* Background lavender glow from top */}
      <View style={styles.lavenderGlow} />

      {/* Hero area */}
      <Animated.View style={[styles.heroContainer, heroAnimStyle]}>
        {heroImage ? (
          <Image source={heroImage} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <View style={styles.heroPlaceholder}>
            <Text style={styles.heroPlaceholderText}>{heroPlaceholderLabel ?? 'Hero image coming soon'}</Text>
          </View>
        )}
      </Animated.View>

      {/* Text content */}
      <Animated.View entering={FadeIn.duration(600)} style={styles.textBlock}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.subtext}>{subtext}</Text>
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
  },
  lavenderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    background: 'transparent',
    // Approximated in RN via a semi-transparent lavender overlay
    backgroundColor: Colors.backgroundLavender,
    opacity: 0.45,
  },
  heroContainer: {
    width: width * 0.82,
    height: height * 0.38,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
    shadowColor: '#222222',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    backgroundColor: Colors.backgroundLavender,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  heroPlaceholderText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  textBlock: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
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
});
