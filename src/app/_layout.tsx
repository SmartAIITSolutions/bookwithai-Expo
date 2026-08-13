import { Stack, router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
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
import { UpdateNagModal, STORE_URL, STORE_URL_FALLBACK } from '@/components/UpdateNagModal';
import { AuthProvider, useAuth, getCachedRole } from '@/lib/auth/AuthContext';
import { FavoritesProvider } from '@/lib/favorites/FavoritesContext';
import { supabase } from '@/lib/supabase';
import { useSegments } from 'expo-router';
import { fetchCustomerProfile, isProfileComplete, linkCustomerIdentity } from '@/lib/api/customerProfile';
import { requestAndRegisterPushToken } from '@/lib/push/registerForPushNotifications';
import { checkInBooking } from '@/lib/api/bookingActions';
import { Alert } from 'react-native';

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

  // "Tap to check in" push -- fires the check-in immediately on tap rather
  // than navigating somewhere requiring a second confirmation, matching the
  // "tap to check in" framing literally. No equivalent listener existed
  // before this; every other notification type is only ever seen via the
  // in-app inbox (notifications.tsx), which doesn't need this since tapping
  // an inbox row is already an explicit in-app action.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const data = response.notification.request.content.data as {
        action?: string; bookingId?: string; url?: string;
        salonId?: string; salonSlug?: string; salonName?: string; requireOnlinePayment?: string;
        serviceIds?: string[]; staffId?: string; suggestedStartsAt?: string;
      } | undefined;
      if (data?.action === 'checkin' && data.bookingId) {
        const result = await checkInBooking(data.bookingId);
        if (result.ok) Alert.alert("You're checked in!", 'The salon has been notified.');
      }
      // Salon's "Send app notification" checkout action -- opens the same
      // secure pay page "Open payment page"/"Copy link"/"Email link" all
      // point at, so the customer can pay without the salon needing their
      // phone number or email at all.
      if (data?.action === 'pay_balance' && data.url) {
        Linking.openURL(data.url);
      }
      // 48h-before payment reminder for a manually-created, still-unpaid
      // booking -- deep-links straight into the in-app Pay Now flow (native
      // PaymentSheet), distinct from pay_balance's external hosted-link open.
      if (data?.action === 'pay_unpaid_booking' && data.bookingId) {
        router.push({
          pathname: '/booking/pay-existing',
          params: { bookingId: data.bookingId },
        } as never);
      }
      // "Update available" broadcast, sent right after app_version_config is
      // bumped for this platform -- tapping it goes straight to the store
      // rather than just opening the app (where the in-app nag only checks
      // on a cold JS mount, not a background->foreground resume).
      if (data?.action === 'app_update' && STORE_URL) {
        const canOpen = await Linking.canOpenURL(STORE_URL);
        Linking.openURL(canOpen ? STORE_URL : STORE_URL_FALLBACK);
      }
      // Rebook nudge (immediate post-checkout, or the weekly "it's time to
      // book" cron) -- lands on the same booking flow a normal "Book Now"
      // tap would, just pre-seeded with the suggested service/staff/time.
      // Every field stays fully editable; nothing here is forced.
      if (data?.action === 'rebook' && data.salonId) {
        router.push({
          pathname: '/booking/services',
          params: {
            salonId: data.salonId,
            salonSlug: data.salonSlug ?? '',
            salonName: data.salonName ?? '',
            requireOnlinePayment: data.requireOnlinePayment ?? 'true',
            ...(data.serviceIds && data.serviceIds.length > 0 ? { prefillServiceIds: data.serviceIds.join(',') } : {}),
            ...(data.staffId ? { prefillStaffId: data.staffId } : {}),
            ...(data.suggestedStartsAt ? { prefillStartsAt: data.suggestedStartsAt } : {}),
            rebookSource: 'rebook_nudge',
          },
        } as never);
      }
      // Review nudge -- lands on My Bookings with that booking's rating
      // panel already open, pre-set to 5 stars for a one-tap submit.
      if (data?.action === 'leave_review' && data.bookingId) {
        router.push({
          pathname: '/(tabs)/my-booking',
          params: { openRatingBookingId: data.bookingId },
        } as never);
      }
    });
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
      <UpdateNagModal />
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
        <Stack.Screen name="owner-settings/payments" options={{ headerShown: true }} />
        <Stack.Screen name="reviews" options={{ headerShown: true }} />
        <Stack.Screen name="customer/[id]" options={{ headerShown: true }} />
        <Stack.Screen name="appointment/[id]" options={{ headerShown: true }} />
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
    console.log('[redirectgate] effect fired', { hasUser: !!user, role, segments: segments.join('/') });
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
      if (role) {
        console.log('[redirectgate] routing from auth stack with resolved role', { role, target: roleHome(role) });
        router.replace(roleHome(role) as never);
      } else {
        // `role` can still be null here even though `loading` is false --
        // AuthContext resolves loading/role in separate state updates, so
        // there's a render in between where a real owner's role hasn't
        // landed yet. roleHome(null) falls through to customer tabs, which
        // was the second half of the owner-routing-to-customer bug: this
        // effect fired on that transient null and sent a real owner to
        // customer tabs before their actual role ever arrived. Prefer their
        // last confirmed role from AsyncStorage over guessing 'customer'.
        getCachedRole(user.id).then((cached) => {
          console.log('[redirectgate] role was null, cache fallback', { cached, target: roleHome(cached?.role ?? role) });
          router.replace(roleHome(cached?.role ?? role) as never);
        });
      }
    } else if (!user && !onAuthStack) {
      // Covers sign-out from any screen -- without this, a signed-out user
      // stays stuck on their last screen until a force-close/reopen
      // triggers the cold-start check in handleSplashDone instead.
      console.log('[redirectgate] no user, redirecting to /auth');
      router.replace('/auth');
    }
  }, [user, role, loading, segments]);

  // Push registration -- fires once per signed-in session, any role. Was
  // owner-only (Sprint 5's Notification Center), but a customer whose
  // bookings are always created by the salon (never their own, through
  // booking/confirmation.tsx) had no path to ever be prompted -- the only
  // other triggers are completing your own booking, or manually tapping
  // "Enable Notifications" on My Bookings/Account. Confirmed live: two real
  // customer accounts with OS-level notification permission already
  // granted still had zero rows in push_tokens, because nothing had ever
  // called requestAndRegisterPushToken() for them. If permission is
  // already granted, this call skips straight to registering a fresh
  // token -- no prompt, no user action needed.
  useEffect(() => {
    if (loading || !user || pushRegistered.current) return;
    pushRegistered.current = true;
    requestAndRegisterPushToken();
  }, [user, role, loading]);

  // Profile-completeness gate -- phone and email are mandatory for
  // customers (the canonical identity every new salon relationship gets
  // auto-filled from). Covers every sign-in method (password, magic link,
  // Apple, Google) and existing accounts that predate this requirement,
  // since it re-checks customer_profiles on every sign-in, not just at
  // signup time. Checked once per user id, not on every render/navigation.
  const profileCheckedForUser = useRef<string | null>(null);
  useEffect(() => {
    if (loading || !user || role !== 'customer') return;
    const onAuthStack = segments[0] === 'auth';
    const onProfileScreen = segments[0] === 'profile';
    if (onAuthStack || onProfileScreen) return;
    if (profileCheckedForUser.current === user.id) return;
    profileCheckedForUser.current = user.id;

    fetchCustomerProfile(user.id)
      .then((profile) => {
        if (!isProfileComplete(profile)) {
          router.replace({ pathname: '/profile', params: { required: 'true' } } as never);
        } else if (profile) {
          // Re-run every sign-in, not just at signup -- a salon can create a
          // matching walk-in or manual booking at any point after this
          // account already exists, so this can't be a one-time check.
          linkCustomerIdentity(profile.phone!, profile.email);
        }
      })
      .catch(() => {
        // Never block app usage on a transient fetch failure -- re-checked
        // next time this effect's dependencies change (e.g. next sign-in).
        profileCheckedForUser.current = null;
      });
  }, [user, role, loading, segments]);

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
    // Deliberately NOT a plain `getSession()` call. On a genuine cold
    // process start (app fully task-killed, not just backgrounded) on a
    // real device, `getSession()` can resolve with a restored session
    // object before the Supabase client has actually finished attaching
    // that session internally -- real-device AsyncStorage reads are
    // measurably slower than an emulator's host-backed disk, which is
    // exactly the gap where this races. The very next authenticated query
    // (the profiles read below) could then fire a beat too early and go
    // out effectively unauthenticated, silently returning zero rows. Only
    // the emulator's near-instant storage I/O ever missed this window,
    // which is why this never reproduced there. Waiting for the client's
    // own first auth state event (INITIAL_SESSION, fired once the stored
    // session has fully settled) instead of racing getSession() + an
    // immediate query removes that gap at the source.
    const session = await new Promise<Session | null>((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        subscription.unsubscribe();
        resolve(session);
      });
    });
    console.log('[coldstart] session resolved', { hasSession: !!session, userId: session?.user?.id });
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
    // A zero-row read here is almost always a transient RLS/token-refresh
    // race on cold launch, not a real "no profile" case (every account gets
    // a profiles row via a DB trigger at signup) -- retry once before
    // trusting an empty read, same fix as AuthContext.loadProfile. Without
    // this, an owner reopening the app could intermittently land on
    // customer tabs whenever this read raced a token refresh.
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();
    console.log('[coldstart] profile query attempt 1', { profile, error: profileError?.message });
    for (const delayMs of [300, 800] as const) {
      if (profile) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      ({ data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle());
      console.log(`[coldstart] profile query retry (${delayMs}ms)`, { profile, error: profileError?.message });
    }
    // Still nothing after both retries -- fall back to this user's last
    // confirmed role (cached by AuthContext on every successful load)
    // instead of defaulting an existing owner/staff account into customer
    // tabs.
    let resolvedRole = profile?.role ?? null;
    if (!profile) {
      const cached = await getCachedRole(session.user.id);
      console.log('[coldstart] falling back to cache', { cached });
      if (cached) resolvedRole = cached.role;
    }
    console.log('[coldstart] final routing decision', { resolvedRole, target: roleHome(resolvedRole) });
    router.replace(roleHome(resolvedRole) as never);
  } catch (error) {
    console.error('handleSplashDone: falling back to /auth after an error', error);
    router.replace('/auth');
  } finally {
    setSplashReady(true);
  }
}
