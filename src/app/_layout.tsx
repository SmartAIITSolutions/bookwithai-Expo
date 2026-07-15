import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
} from '@expo-google-fonts/sora';
import {
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SplashOverlay } from '@/components/SplashOverlay';

// Extract salon slug from a bookwithai.app/book/<slug> URL
function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/bookwithai\.app\/book\/([^/?#]+)/);
  return match ? match[1] : null;
}

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY = 'bwa_onboarding_done';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  const [splashVisible, setSplashVisible] = useState(true);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      checkOnboarding();
    }
  }, [fontsLoaded]);

  // Handle incoming deep links (cold start + warm start)
  useEffect(() => {
    // Cold start — app opened via link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    // Warm start — app already open
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  function handleDeepLink(url: string) {
    const slug = extractSlugFromUrl(url);
    if (slug) {
      router.push({ pathname: '/salon/[id]', params: { id: slug } });
    }
  }

  async function checkOnboarding() {
    const done = await AsyncStorage.getItem(ONBOARDING_KEY);
    if (!done) {
      // Will navigate to onboarding after splash fades
    }
    setOnboardingChecked(true);
  }

  function handleSplashDone() {
    setSplashVisible(false);
    AsyncStorage.getItem(ONBOARDING_KEY).then((done) => {
      if (!done) {
        router.replace('/onboarding');
      }
    });
  }

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="salon/[id]" />
        <Stack.Screen name="booking/services" />
        <Stack.Screen name="booking/staff" />
        <Stack.Screen name="booking/datetime" />
        <Stack.Screen name="booking/review" />
        <Stack.Screen name="booking/payment" />
        <Stack.Screen name="booking/confirmation" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
        <Stack.Screen name="legal/support" />
        <Stack.Screen name="legal/delete-account" />
      </Stack>
      {splashVisible && fontsLoaded && <SplashOverlay onDone={handleSplashDone} />}
    </>
  );
}
