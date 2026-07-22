import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { supabase } from '@/lib/supabase';
import { getPasswordError } from '@/lib/validation';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Landed here after tapping a Supabase password-reset email link (see
// handleDeepLink in _layout.tsx), which establishes a recovery session
// before routing here.
export default function ResetPasswordScreen() {
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving,          setSaving]          = useState(false);

  async function handleSetPassword() {
    const pwError = getPasswordError(password);
    if (pwError) {
      Alert.alert('Invalid password', pwError);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Please re-enter to confirm.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      Alert.alert('Could not reset password', error.message);
      return;
    }
    Alert.alert(
      'Password updated',
      'Your password has been reset. Please sign in with your new password.',
      [{ text: 'OK', onPress: () => router.replace('/auth/sign-in') }]
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>
            <Text style={styles.title}>Set a New Password</Text>
            <Text style={styles.subtitle}>Choose a new password for your account.</Text>

            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>New password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {password.length > 0 && getPasswordError(password) && (
                  <Text style={styles.errorText}>{getPasswordError(password)}</Text>
                )}
                {password.length === 0 && (
                  <Text style={styles.hintText}>
                    At least 8 characters, with an uppercase letter, a lowercase letter, and a number.
                  </Text>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </BlurView>

            <Pressable
              style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
              onPress={handleSetPassword}
              disabled={saving}>
              {saving
                ? <BreathingHeart size={18} color="#09000F" />
                : <Text style={styles.submitBtnText}>Reset Password</Text>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.lg },

  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },

  card: {
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    gap: Spacing.md,
  },
  fieldGroup: { gap: Spacing.xs },
  label: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  errorText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#F09595',
  },
  hintText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.45)',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  submitBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
});
