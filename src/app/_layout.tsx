import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
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
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SplashOverlay } from '@/components/SplashOverlay';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from '@/lib/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSegments } from 'expo-router';
import { requestAndRegisterPushToken } from '@/lib/push/registerForPushNotifications';

// Extract salon slug from a bookwithai.app/book/<slug> URL
function extractSlugFromUrl(url: string): string | null {
  const match = url.match(/bookwithai\.app\/book\/([^/?#]+)/);
  return match ? match[1] : null;
}

// Supabase auth links carry their tokens either as query params (PKCE
// "code") or a URL fragment ("#access_token=...&refresh_token=...",
// implicit flow) depending on project config -- merge both into one bag
// so callers don't need to know which flow is active.
function parseAuthParams(url: string): URLSearchParams {
  const [, queryPart] = url.split('?');
  const [, hashPart] = url.split('#');
  const combined = [queryPart, hashPart].filter(Boolean).join('&');
  return new URLSearchParams(combined);
}

SplashScreen.preventAutoHideAsync();

// Show a banner + play sound even while the app is open in the foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

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
      return;
    }
    if (url.includes('auth/staff-invite')) {
      handleStaffInviteLink(url);
    }
  }

  async function handleStaffInviteLink(url: string) {
    const params = parseAuthParams(url);
    const code = params.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    try {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } else {
        return;
      }
      router.replace('/auth/staff-set-password');
    } catch (e) {
      // Invite link expired/invalid -- staff can still ask the owner to resend.
    }
  }

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <BottomSheetModalProvider>
    <AuthProvider>
      <StatusBar style="dark" />
      <OfflineBanner />
      <AuthRedirectGate />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="owner-settings/business" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/services" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/staff" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/time-off" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/clock" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/products" options={{ headerShown: true }} />
        <Stack.Screen name="customer/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="customer/merge-duplicates" options={{ headerShown: true }} />
        <Stack.Screen name="owner-notifications" options={{ headerShown: true }} />
        <Stack.Screen name="account-security" options={{ headerShown: true }} />
        <Stack.Screen name="profile" options={{ headerShown: true }} />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="salon/[id]" />
        <Stack.Screen name="booking/services" />
        <Stack.Screen name="booking/staff" />
        <Stack.Screen name="booking/datetime" />
        <Stack.Screen name="booking/review" />
        <Stack.Screen name="booking/payment" />
        <Stack.Screen name="booking/confirmation" />
        <Stack.Screen name="booking/receipt" />
        <Stack.Screen name="legal/privacy" />
        <Stack.Screen name="legal/terms" />
        <Stack.Screen name="legal/support" />
        <Stack.Screen name="legal/delete-account" />
      </Stack>
      {splashVisible && fontsLoaded && (
        <SplashOverlay onDone={() => handleSplashDone(setSplashVisible)} />
      )}
    </AuthProvider>
    </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

// Watches auth state and moves a now-signed-in user off the /auth stack
// (covers sign-in, sign-up, magic link, and Google OAuth completing).
// Routes by role — 'owner' lands in the salon-owner shell, everyone else
// (including the 'customer' default) lands in the existing customer tabs.
function AuthRedirectGate() {
  const { user, role, loading } = useAuth();
  const segments = useSegments();
  const pushRegistered = useRef(false);

  useEffect(() => {
    if (loading) return;
    const onAuthStack = segments[0] === 'auth';
    if (user && onAuthStack) {
      router.replace(roleHome(role) as never);
    }
  }, [user, role, loading, segments]);

  // Owner push registration -- Sprint 5's real Notification Center needs a
  // device token on file. Fires once per signed-in owner session.
  useEffect(() => {
    if (loading || !user || role !== 'owner' || pushRegistered.current) return;
    pushRegistered.current = true;
    requestAndRegisterPushToken();
  }, [user, role, loading]);

  return null;
}

function roleHome(role: string | null): string {
  if (role === 'owner') return '/(owner)/dashboard';
  if (role === 'staff') return '/(staff)/schedule';
  return '/(tabs)/book';
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

  // 4. Signed in, no biometrics lock — route by role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle();
  router.replace(roleHome(profile?.role ?? null) as never);
}
