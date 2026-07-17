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
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { useAuth } from '@/lib/auth/AuthContext';

export default function BiometricsScreen() {
  const { signOut, role } = useAuth();
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');

  useEffect(() => {
    detectBiometricType();
    // Auto-trigger on mount
    handleAuthenticate();
  }, []);

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
        promptMessage:  'Unlock Book With AI',
        fallbackLabel:  'Use password instead',
        cancelLabel:    'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        router.replace(role === 'owner' ? '/(owner)/dashboard' : '/(tabs)/book');
      }
    } catch (e) {
      // User cancelled or error — stay on screen
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Sign out?',
      'You\'ll need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
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
  const label = biometricType === 'face' ? 'Face ID' : 'Fingerprint';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        <Text style={styles.appName}>Book With AI</Text>
        <Text style={styles.subtitle}>Unlock to continue</Text>

        <Pressable
          style={({ pressed }) => [styles.biometricBtn, pressed && { opacity: 0.8 }]}
          onPress={handleAuthenticate}>
          <Ionicons name={icon} size={48} color={Colors.primary} />
          <Text style={styles.biometricLabel}>Use {label}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.passwordBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/auth/sign-in')}>
          <Text style={styles.passwordBtnText}>Use Password Instead</Text>
        </Pressable>

        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
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
