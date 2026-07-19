import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getPasswordError } from '@/lib/validation';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>Set a New Password</Text>
          <Text style={styles.subtitle}>Choose a new password for your account.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={Colors.textDisabled}
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
              placeholderTextColor={Colors.textDisabled}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
            onPress={handleSetPassword}
            disabled={saving}>
            {saving
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.submitBtnText}>Reset Password</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.lg },

  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },

  fieldGroup: { gap: Spacing.xs },
  label: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  errorText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.error,
  },
  hintText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.button,
  },
  submitBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
