/**
 * Biometrics Unlock Screen
 * Shown when a user has a saved session — asks for fingerprint/Face ID to unlock.
 * Falls back to password sign-in if biometrics fails or is dismissed.
 */
import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { hasPin } from '@/lib/auth/pin';

export default function BiometricsScreen() {
  const { t } = useTranslation(['auth', 'common']);
  const { signOut, role } = useAuth();
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');
  const [pinAvailable, setPinAvailable] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    detectBiometricType();
    hasPin().then(setPinAvailable);
    // Auto-trigger on mount
    handleAuthenticate();
  }, []);

  // Deliberately a separate effect, not decided inline inside
  // handleAuthenticate() -- that success callback closed over `role` from
  // this screen's very first render (its own effect above has an empty dep
  // array), almost always still null at that point since AuthContext
  // hasn't resolved yet. authenticateAsync() then waits for the actual
  // Face ID/fingerprint scan -- real hardware, real user time -- so by the
  // time it resolved, the *real* current role was already 'owner'
  // elsewhere in the app, but the stale closure still redirected off the
  // outdated null, silently overwriting an already-correct owner-dashboard
  // redirect with customer tabs. This was the actual root cause of owner
  // accounts intermittently landing on customer tabs after unlocking with
  // biometrics -- only ever reproduced on a real device (an emulator has
  // no real biometric-scan delay to expose the race), and needed no
  // elapsed time at all to trigger. Waiting here for both `unlocked` and a
  // resolved `role` means this always reads the current value.
  useEffect(() => {
    if (unlocked && role) {
      router.replace(role === 'owner' ? '/(owner)/dashboard' : '/(tabs)/book');
    }
  }, [unlocked, role]);

  async function detectBiometricType() {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      setBiometricType('face');
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      setBiometricType('fingerprint');
    }
  }

  async function handleAuthenticate() {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage:  t('auth:biometrics.unlockPrompt'),
        fallbackLabel:  t('auth:biometrics.fallbackLabel'),
        cancelLabel:    t('common:cancel'),
        disableDeviceFallback: false,
      });

      if (result.success) {
        setUnlocked(true);
      }
    } catch (e) {
      // User cancelled or error — stay on screen
    }
  }

  async function handleSignOut() {
    Alert.alert(
      t('auth:biometrics.signOutConfirmTitle'),
      t('auth:biometrics.signOutConfirmMessage'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('auth:biometrics.signOut'),
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  }

  const icon = biometricType === 'face' ? 'scan-outline' : 'finger-print-outline';
  const label = biometricType === 'face' ? t('auth:biometrics.faceId') : t('auth:biometrics.fingerprint');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <Text style={styles.appName}>{t('auth:biometrics.appName')}</Text>
        <Text style={styles.subtitle}>{t('auth:biometrics.subtitle')}</Text>

        <Pressable
          style={({ pressed }) => [styles.biometricBtn, pressed && { opacity: 0.8 }]}
          onPress={handleAuthenticate}>
          <Ionicons name={icon} size={48} color={Colors.primary} />
          <Text style={styles.biometricLabel}>{t('auth:biometrics.useLabel', { type: label })}</Text>
        </Pressable>

        {pinAvailable && (
          <Pressable
            style={({ pressed }) => [styles.passwordBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.replace('/auth/pin-entry')}>
            <Text style={styles.passwordBtnText}>{t('auth:biometrics.usePinInstead')}</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.passwordBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/auth/sign-in')}>
          <Text style={styles.passwordBtnText}>{t('auth:biometrics.usePasswordInstead')}</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{t('auth:biometrics.signOut')}</Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },

  appName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: -Spacing.lg,
  },

  biometricBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.backgroundLavender,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  biometricLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },

  passwordBtn: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  passwordBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  signOutBtn: { marginTop: Spacing.md },
  signOutText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
