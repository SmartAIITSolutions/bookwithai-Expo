import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BreathingHeart } from '@/components/BreathingHeart';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { supabase } from '@/lib/supabase';
import { isValidEmail, isValidPhone, getPasswordError } from '@/lib/validation';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function SignUpScreen() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const breatheVal = useSharedValue(0);
  useEffect(() => {
    breatheVal.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [breatheVal]);
  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breatheVal.value * 0.03 }],
  }));

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
      const { data, error } = await supabase.auth.signUp({
        email:    email.trim(),
        password: password.trim(),
        options: {
          data: { full_name: name.trim(), phone: phone.trim() },
        },
      });
      if (error) throw error;
      // Account creation doesn't require email confirmation to sign in --
      // if signUp already returned a session, AuthRedirectGate picks it up
      // and routes home automatically. Otherwise fall back to sign-in.
      if (!data.session) {
        router.replace('/auth/sign-in');
      }
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#F4D77A" />
              </Pressable>
              <Text style={styles.title}>Create Account</Text>
              <View style={styles.backBtn} />
            </View>

            <Text style={styles.subtitle}>Join Book With AI to manage your appointments.</Text>

            {/* Fields */}
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Jane Smith"
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
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
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="phone-pad"
                />
                {phone.length > 0 && !isValidPhone(phone) && (
                  <Text style={styles.errorText}>Please enter a valid phone number.</Text>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.passwordWrap}>
                  <TextInput
                    style={[styles.input, styles.passwordInput]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min. 8 characters"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    secureTextEntry={!showPass}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Pressable onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                    <Ionicons
                      name={showPass ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="rgba(255,255,255,0.6)"
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
            </BlurView>

            <Reanimated.View style={breatheStyle}>
              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSignUp}
                disabled={loading}>
                {loading
                  ? <BreathingHeart size={18} color="#09000F" />
                  : <Text style={styles.submitBtnText}>Create Account</Text>
                }
              </Pressable>
            </Reanimated.View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
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
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.75)',
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
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eyeBtn: {
    position: 'absolute',
    right: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
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

  legalText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.6,
  },
  legalLink: {
    color: '#F4D77A',
    fontFamily: FontFamily.soraSemiBold,
  },

  switchBtn: { alignItems: 'center' },
  switchText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  switchLink: { color: '#F4D77A', fontFamily: FontFamily.soraSemiBold },
});
