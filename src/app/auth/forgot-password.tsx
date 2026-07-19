import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { isValidEmail } from '@/lib/validation';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function ForgotPasswordScreen() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleReset() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please type your email address.');
      return;
    }
    if (!isValidEmail(email)) {
      return;
    }
    try {
      setLoading(true);
      const redirectTo = Linking.createURL('auth/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>

          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.title}>Reset Password</Text>
            <View style={styles.backBtn} />
          </View>

          {sent ? (
            <View style={styles.sentState}>
              <View style={styles.sentIcon}>
                <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
              </View>
              <Text style={styles.sentTitle}>Email sent!</Text>
              <Text style={styles.sentSubtitle}>
                Check your inbox for a password reset link.
              </Text>
              <Pressable
                style={({ pressed }) => [styles.backToSignIn, pressed && { opacity: 0.85 }]}
                onPress={() => router.replace('/auth/sign-in')}>
                <Text style={styles.backToSignInText}>Back to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="jane@example.com"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {email.length > 0 && !isValidEmail(email) && (
                  <Text style={styles.errorText}>Please enter a valid email address.</Text>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]}
                onPress={handleReset}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.sendBtnText}>Send Reset Link</Text>
                }
              </Pressable>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: { flex: 1, padding: Spacing.xl, gap: Spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
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

  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    ...Shadows.button,
  },
  sendBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  sentState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  sentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },
  sentSubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  backToSignIn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  backToSignInText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
