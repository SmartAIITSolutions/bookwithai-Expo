import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { isValidEmail, isValidPhone, getPasswordError } from '@/lib/validation';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function SignUpScreen() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  function getFormErrors(): string[] {
    const errors: string[] = [];
    if (!name.trim()) errors.push('Full name is required.');
    if (!email.trim()) errors.push('Email is required.');
    else if (!isValidEmail(email)) errors.push('Enter a valid email address.');
    if (!phone.trim()) errors.push('Phone number is required.');
    else if (!isValidPhone(phone)) errors.push('Enter a valid phone number.');
    if (!password.trim()) errors.push('Password is required.');
    else {
      const pwError = getPasswordError(password);
      if (pwError) errors.push(pwError);
    }
    return errors;
  }

  async function handleSignUp() {
    const errors = getFormErrors();
    if (errors.length > 0) {
      Alert.alert('Please fix the following', errors.join('\n'));
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email:    email.trim(),
        password: password.trim(),
        options: {
          data: { full_name: name.trim(), phone: phone.trim() },
        },
      });
      if (error) throw error;
      Alert.alert(
        'Check your email',
        'We sent you a confirmation link. Tap it to activate your account.',
        [{ text: 'OK', onPress: () => router.replace('/auth/sign-in') }]
      );
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.title}>Create Account</Text>
            <View style={styles.backBtn} />
          </View>

          <Text style={styles.subtitle}>Join Book With AI to manage your appointments.</Text>

          {/* Fields */}
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Jane Smith"
                placeholderTextColor={Colors.textDisabled}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="jane@example.com"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {email.length > 0 && !isValidEmail(email) && (
                <Text style={styles.errorText}>Please enter a valid email address.</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Phone *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={Colors.textDisabled}
                keyboardType="phone-pad"
              />
              {phone.length > 0 && !isValidPhone(phone) && (
                <Text style={styles.errorText}>Please enter a valid phone number.</Text>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={Colors.textDisabled}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textSecondary}
                  />
                </Pressable>
              </View>
              {password.length > 0 && getPasswordError(password) && (
                <Text style={styles.errorText}>{getPasswordError(password)}</Text>
              )}
              {password.length === 0 && (
                <Text style={styles.hintText}>
                  At least 8 characters, with an uppercase letter, a lowercase letter, and a number.
                </Text>
              )}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
            onPress={handleSignUp}
            disabled={loading}>
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.submitBtnText}>Create Account</Text>
            }
          </Pressable>

          <Text style={styles.legalText}>
            By creating an account, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/legal/terms')}>Terms</Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={() => router.push('/legal/privacy')}>Privacy Policy</Text>.
          </Text>

          <Pressable style={styles.switchBtn} onPress={() => router.replace('/auth/sign-in')}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign in</Text></Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  scroll: { padding: Spacing.xl, gap: Spacing.lg },

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

  form: { gap: Spacing.md },
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
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    backgroundColor: Colors.white,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: Colors.border,
    borderTopRightRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: 'center',
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

  legalText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.6,
  },
  legalLink: {
    color: Colors.primary,
    fontFamily: FontFamily.soraSemiBold,
  },

  switchBtn: { alignItems: 'center' },
  switchText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  switchLink: { color: Colors.primary, fontFamily: FontFamily.soraSemiBold },
});
