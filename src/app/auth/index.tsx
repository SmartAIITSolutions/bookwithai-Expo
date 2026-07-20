/**
 * Auth Welcome Screen
 * Options: Google Sign In, Email + Password, Magic Link
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

WebBrowser.maybeCompleteAuthSession();

export default function AuthWelcomeScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);

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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Logo / Branding */}
        <View style={styles.brand}>
          <Text style={styles.logo}>✦</Text>
          <Text style={styles.appName}>Book With AI</Text>
          <Text style={styles.tagline}>Your bookings, beautifully simple.</Text>
        </View>

        {/* Auth options */}
        <View style={styles.options}>

          {/* Google */}
          <Pressable
            style={({ pressed }) => [styles.googleBtn, pressed && styles.btnPressed]}
            onPress={handleGoogleSignIn}
            disabled={googleLoading}>
            {googleLoading
              ? <ActivityIndicator color={Colors.textPrimary} />
              : <>
                  <Text style={styles.googleIcon}>G</Text>
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </>
            }
          </Pressable>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email + Password */}
          <Pressable
            style={({ pressed }) => [styles.emailBtn, pressed && styles.btnPressed]}
            onPress={() => router.push('/auth/sign-up')}>
            <Text style={styles.emailBtnText}>Create an Account</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.signInBtn, pressed && styles.btnPressed]}
            onPress={() => router.push('/auth/sign-in')}>
            <Text style={styles.signInBtnText}>Sign In with Email</Text>
          </Pressable>

          {/* Magic Link */}
          <Pressable
            style={styles.magicLinkBtn}
            onPress={() => router.push('/auth/magic-link')}>
            <Text style={styles.magicLinkText}>Send me a magic link instead</Text>
          </Pressable>

        </View>

        <Text style={styles.legalNote}>
          By continuing you agree to our{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal/terms')}>Terms</Text>
          {' '}and{' '}
          <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>.
        </Text>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
    gap: Spacing.lg,
  },

  brand: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
  logo: {
    fontSize: 48,
    color: Colors.primary,
  },
  appName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['3xl'],
    color: Colors.textPrimary,
  },
  tagline: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  options: { gap: Spacing.md },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  googleIcon: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#4285F4',
  },
  googleBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },

  emailBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.button,
  },
  emailBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  signInBtn: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  signInBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  magicLinkBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  magicLinkText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },

  btnPressed: { opacity: 0.8 },

  legalNote: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.6,
  },
  legalLink: { color: Colors.primary, textDecorationLine: 'underline' },
});
