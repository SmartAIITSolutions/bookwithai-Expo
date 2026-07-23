/**
 * Auth Welcome Screen
 * Options: Sign in with Apple, Google Sign In, Email + Password, Magic Link
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Alert, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as AppleAuthentication from 'expo-apple-authentication';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import Reanimated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const BUTTON_COUNT = 5;
const CYCLE_DURATION = 4000;

function useBreatheStyle(cycle: SharedValue<number>, index: number) {
  return useAnimatedStyle(() => {
    const raw = Math.abs(cycle.value - index);
    const d = Math.min(raw, BUTTON_COUNT - raw);
    const intensity = Math.max(0, 1 - d);
    return { transform: [{ scale: 1 + intensity * 0.04 }] };
  });
}

WebBrowser.maybeCompleteAuthSession();

function OrDivider() {
  return (
    <View style={styles.divider}>
      <LinearGradient
        colors={['transparent', 'rgba(212,175,55,0.5)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dividerLine}
      />
      <Text style={styles.dividerText}>or</Text>
      <LinearGradient
        colors={['rgba(212,175,55,0.5)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dividerLine}
      />
    </View>
  );
}

function GoogleGIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.72-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}

export default function AuthWelcomeScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const cycle = useSharedValue(0);
  useEffect(() => {
    cycle.value = withRepeat(
      withTiming(BUTTON_COUNT, { duration: CYCLE_DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, [cycle]);

  const appleBreathe = useBreatheStyle(cycle, 0);
  const googleBreathe = useBreatheStyle(cycle, 1);
  const createBreathe = useBreatheStyle(cycle, 2);
  const signInBreathe = useBreatheStyle(cycle, 3);
  const magicBreathe = useBreatheStyle(cycle, 4);

  // Guideline 4.8 -- offered because Google Sign-In is also offered.
  // Supabase's native-token flow (not the web-redirect OAuth flow used for
  // Google) since expo-apple-authentication already produces a real Apple
  // identity token on-device, no browser round-trip needed.
  async function handleAppleSignIn() {
    try {
      setAppleLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token returned from Apple.');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return; // user dismissed the Apple sheet, not an error
      Alert.alert('Sign in failed', e.message || 'Could not sign in with Apple.');
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    try {
      setGoogleLoading(true);
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      // Opens the browser for sign-in. Deliberately not relying on this
      // promise's resolved result for the actual code exchange -- on
      // Android it can hang forever if the app's own deep-link handling
      // (_layout.tsx's handleDeepLink) claims the redirect first. That
      // handler does the real exchangeCodeForSession() independently and
      // reliably, the same way staff invites and password resets work.
      await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    } catch (e: any) {
      Alert.alert('Sign in failed', e.message || 'Could not sign in with Google.');
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Logo / Branding */}
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Canvas style={styles.logoGlow} pointerEvents="none">
              <Circle cx={220} cy={220} r={220}>
                <RadialGradient
                  c={vec(220, 220)}
                  r={220}
                  colors={['rgba(212,175,55,0.35)', 'rgba(212,175,55,0)']}
                />
              </Circle>
            </Canvas>
            <Image
              source={require('@/assets/images/bwa-gold-logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.appName}>Book With AI</Text>
          <Text style={styles.tagline}>Your bookings, beautifully simple.</Text>
        </View>

        {/* Auth options */}
        <View style={styles.options}>

          {/* Apple -- shown above Google, since Apple requires Sign in with
              Apple to be at least as prominent as any other third-party
              login when one is offered. Real Apple button component (not a
              custom-styled Pressable), matching Apple's own HIG. */}
          {appleAvailable && (
            <Reanimated.View style={appleBreathe}>
              {appleLoading ? (
                <View style={styles.appleLoadingBtn}><BreathingHeart size={18} color="#09000F" /></View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={BorderRadius.lg}
                  style={styles.appleBtn}
                  onPress={handleAppleSignIn}
                />
              )}
            </Reanimated.View>
          )}

          {appleAvailable && <OrDivider />}

          {/* Google */}
          <Reanimated.View style={googleBreathe}>
            <Pressable
              style={({ pressed }) => [styles.googleBtn, pressed && styles.btnPressed]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}>
              {googleLoading
                ? <BreathingHeart size={18} color="#F4D77A" />
                : <>
                    <GoogleGIcon size={20} />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
              }
            </Pressable>
          </Reanimated.View>

          <OrDivider />

          {/* Email + Password */}
          <Reanimated.View style={createBreathe}>
            <Pressable
              style={({ pressed }) => [styles.emailBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/auth/account-type')}>
              <Text style={styles.emailBtnText}>Create an Account</Text>
            </Pressable>
          </Reanimated.View>

          <OrDivider />

          <Reanimated.View style={signInBreathe}>
            <Pressable
              style={({ pressed }) => [styles.signInBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/auth/sign-in')}>
              <Text style={styles.signInBtnText}>Sign In with Email</Text>
            </Pressable>
          </Reanimated.View>

          <OrDivider />

          {/* Magic Link */}
          <Reanimated.View style={magicBreathe}>
            <Pressable
              style={({ pressed }) => [styles.magicLinkBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/auth/magic-link')}>
              <Ionicons name="mail-outline" size={16} color="#09000F" />
              <Text style={styles.magicLinkText}>Send me a magic link instead</Text>
            </Pressable>
          </Reanimated.View>

        </View>

        <Text style={styles.legalNote}>
          By continuing you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal/terms')}>Terms</Text>
          {' '}and{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>.
        </Text>

      </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.lg,
  },

  brand: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  logoWrap: {
    width: 440,
    height: 440,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -176,
  },
  logoGlow: { position: 'absolute', width: 440, height: 440 },
  logoImage: { width: 330, height: 220 },
  appName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['3xl'],
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    marginTop: -168,
  },
  tagline: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  options: { gap: Spacing.md },

  appleBtn: {
    width: '100%',
    height: 50,
  },
  appleLoadingBtn: {
    width: '100%',
    height: 50,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#0F0A18',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  googleBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
  },

  emailBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  emailBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },

  signInBtn: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  signInBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },

  magicLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  magicLinkText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },

  btnPressed: { opacity: 0.8 },

  legalNote: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.6,
  },
  legalLink: { color: '#F4D77A', textDecorationLine: 'underline' },
});
