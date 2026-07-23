import { Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Sora_300Light,
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
import {
  PlayfairDisplay_600SemiBold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
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
import { FavoritesProvider } from '@/lib/favorites/FavoritesContext';
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
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlayfairDisplay_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [splashVisible, setSplashVisible] = useState(true);
  const [splashReady, setSplashReady] = useState(false);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Kicks off as soon as fonts are ready, in parallel with the SplashOverlay's
  // grow/glow animation -- the animation loops indefinitely until this chain
  // actually resolves and navigates, so slow networks just see a longer
  // glow instead of a blank screen or a stale fixed-duration splash.
  useEffect(() => {
    if (fontsLoaded) {
      handleSplashDone(setSplashReady);
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
      return;
    }
    if (url.includes('auth/reset-password')) {
      handlePasswordRecoveryLink(url);
      return;
    }
    if (url.includes('auth/callback')) {
      handleGoogleOAuthCallback(url);
    }
  }

  // Google Sign-In's redirect target. Deliberately does NOT rely on
  // WebBrowser.openAuthSessionAsync()'s resolved result (auth/index.tsx) --
  // on Android that promise can hang forever if this app's own deep-link
  // handling claims the redirect first, which is exactly what was
  // happening. This handler is the same proven-reliable path already used
  // for staff invites and password resets. No explicit navigation needed
  // afterward -- AuthRedirectGate picks up the new session and routes by
  // role automatically, same as any other sign-in method.
  async function handleGoogleOAuthCallback(url: string) {
    const params = parseAuthParams(url);
    const code = params.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    try {
      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
      } else if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    } catch (e) {
      // Redirect had no valid code/tokens, or the code was already
      // consumed -- nothing to recover here, user can just retry sign-in.
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

  async function handlePasswordRecoveryLink(url: string) {
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
      router.replace('/auth/reset-password');
    } catch (e) {
      // Reset link expired/invalid -- user can request a new one from Forgot Password.
    }
  }

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <BottomSheetModalProvider>
    <AuthProvider>
    <FavoritesProvider>
      <StatusBar style="dark" />
      <OfflineBanner />
      <AuthRedirectGate />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          animationDuration: 650,
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(owner)" />
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="owner-settings/business" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/services" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/staff" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/time-off" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/clock" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/products" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/membership-plans" options={{ headerShown: true }} />
        <Stack.Screen name="owner-settings/service-packages" options={{ headerShown: true }} />
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
        <Stack.Screen name="legal/delete-account" options={{ headerShown: true }} />
      </Stack>
      {splashVisible && fontsLoaded && (
        <SplashOverlay ready={splashReady} onDone={() => setSplashVisible(false)} />
      )}
    </FavoritesProvider>
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
    // The owner sign-up wizard calls supabase.auth.signUp() partway through
    // its own flow (step 3), which establishes a session and makes `user`
    // truthy immediately -- well before the wizard's own follow-up
    // `profiles.role = 'owner'` update commits. Without this guard, this
    // effect would fire on that stale 'customer' role (the DB trigger's
    // default) and yank the new owner into customer tabs mid-wizard, before
    // they ever reach the business-profile/hours/Stripe steps. The wizard
    // manages its own navigation to the owner dashboard once it's actually
    // done, via router.replace('/(owner)/dashboard').
    const onOwnerSignupWizard = segments[0] === 'auth' && segments[1] === 'owner-signup';
    if (onOwnerSignupWizard) return;
    if (user && onAuthStack) {
      router.replace(roleHome(role) as never);
    } else if (!user && !onAuthStack) {
      // Covers sign-out from any screen -- without this, a signed-out user
      // stays stuck on their last screen until a force-close/reopen
      // triggers the cold-start check in handleSplashDone instead.
      router.replace('/auth');
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

async function handleSplashDone(setSplashReady: (v: boolean) => void) {
  // The SplashOverlay keeps growing/glowing (and looping) for this entire
  // decision chain -- marking it ready early would fade it out and expose
  // the app's default route for however long the async checks below took,
  // before the real destination was known.
  //
  // Everything below is wrapped in try/catch/finally: this whole chain runs
  // on every cold launch, so any single failure here (a network blip on
  // getSession(), a storage read failure, etc.) with no safety net would
  // leave the splash screen spinning forever with no way for the user to
  // proceed -- the app would look completely frozen. On failure, fall back
  // to /auth (the safest default -- if the user actually has a valid
  // session, AuthContext's own session check and AuthRedirectGate will
  // still route them home once it resolves).
  try {
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
  } catch (error) {
    console.error('handleSplashDone: falling back to /auth after an error', error);
    router.replace('/auth');
  } finally {
    setSplashReady(true);
  }
}
