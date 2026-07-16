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
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SplashOverlay } from '@/components/SplashOverlay';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSegments } from 'expo-router';

// Extract salon slug from a bookwithai.app/book/<slug> URL
function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/bookwithai\.app\/book\/([^/?#]+)/);
  return match ? match[1] : null;
}

SplashScreen.preventAutoHideAsync();

const ONBOARDING_KEY    = 'bwa_onboarding_done';
const BIOMETRICS_KEY    = 'bwa_biometrics_enabled';

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

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Handle incoming deep links (cold start + warm start)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  function handleDeepLink(url: string) {
    const slug = extractSlugFromUrl(url);
    if (slug) {
      router.push({ pathname: '/salon/[id]', params: { id: slug } });
    }
  }

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthRedirectGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
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
      {splashVisible && fontsLoaded && (
        <SplashOverlay onDone={() => handleSplashDone(setSplashVisible)} />
      )}
    </AuthProvider>
  );
}

// Watches auth state and moves a now-signed-in user off the /auth stack
// (covers sign-in, sign-up, magic link, and Google OAuth completing).
function AuthRedirectGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const onAuthStack = segments[0] === 'auth';
    if (user && onAuthStack) {
      router.replace('/(tabs)/book');
    }
  }, [user, loading, segments]);

  return null;
}

async function handleSplashDone(setSplashVisible: (v: boolean) => void) {
  setSplashVisible(false);

  // 1. Check onboarding
  const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
  if (!onboardingDone) {
    router.replace('/onboarding');
    return;
  }

  // 2. Auth is mandatory — no session, no entry
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    router.replace('/auth');
    return;
  }

  // 3. Signed in — check biometrics lock before letting them into tabs
  const biometricsEnabled = await SecureStore.getItemAsync(BIOMETRICS_KEY);
  if (biometricsEnabled === 'true') {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled   = await LocalAuthentication.isEnrolledAsync();
    if (hasHardware && isEnrolled) {
      router.replace('/auth/biometrics');
      return;
    }
  }

  // 4. Signed in, no biometrics lock — straight to tabs
  router.replace('/(tabs)/book');
}
