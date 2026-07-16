import { useRef, useState } from 'react';
import { View, ScrollView, Dimensions, StyleSheet, Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingSlide } from '@/components/onboarding/OnboardingSlide';
import { Slide4Final } from '@/components/onboarding/Slide4Final';
import { ProgressDots } from '@/components/onboarding/ProgressDots';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/Theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    headline: 'Beauty Booking.\nMade Beautiful.',
    subtext:
      'Discover trusted salons, barbers, nail studios, spas, and beauty professionals—all in one place.',
    heroImage: require('@/assets/images/onboarding-slide-1.png'),
    heroPlaceholderLabel: 'Slide 1 hero — luxury salon reception photo',
  },
  {
    headline: 'Book Anytime.\nAnywhere.',
    subtext:
      'View services, choose your favorite professional, and book your appointment in just a few taps.',
    heroImage: require('@/assets/images/onboarding-slide-2.png'),
    heroPlaceholderLabel: 'Slide 2 hero — hand holding phone with booking screen',
  },
  {
    headline: 'Stay Organized.',
    subtext:
      'Get confirmations, reminders, and manage all your appointments in one place.',
    heroImage: require('@/assets/images/onboarding-slide-3.png'),
    heroPlaceholderLabel: 'Slide 3 hero — iPhone mockup with reminder notification',
  },
];

const ONBOARDING_KEY = 'bwa_onboarding_done';

async function markOnboardingDone() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  function goToSlide(index: number) {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  }

  function handleNext() {
    if (activeIndex < SLIDES.length) {
      goToSlide(activeIndex + 1);
    }
  }

  function handleSkip() {
    goToSlide(SLIDES.length); // jump to slide 4
  }

  async function handleGetStarted() {
    await markOnboardingDone();
    router.replace('/auth');
  }

  async function handleSignIn() {
    await markOnboardingDone();
    router.replace('/auth/sign-in');
  }

  const isLastSlide = activeIndex === SLIDES.length;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}>
        {SLIDES.map((slide, i) => (
          <OnboardingSlide
            key={i}
            headline={slide.headline}
            subtext={slide.subtext}
            heroImage={slide.heroImage}
            heroPlaceholderLabel={slide.heroPlaceholderLabel}
            isActive={activeIndex === i}
          />
        ))}
        <Slide4Final onGetStarted={handleGetStarted} onSignIn={handleSignIn} />
      </ScrollView>

      {/* Bottom controls — hidden on slide 4 */}
      {!isLastSlide && (
        <View style={styles.controls}>
          <Pressable onPress={handleSkip}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          <ProgressDots count={SLIDES.length + 1} activeIndex={activeIndex} />

          <Pressable style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextText}>Next</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  scroll: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.lg,
    backgroundColor: Colors.backgroundMain,
  },
  skipText: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    width: 48,
  },
  nextButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 14,
  },
  nextText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
