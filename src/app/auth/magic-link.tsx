import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
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
import { isValidEmail } from '@/lib/validation';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function MagicLinkScreen() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

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

  async function handleSend() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please type your email address to receive a magic link.');
      return;
    }
    if (!isValidEmail(email)) {
      return;
    }
    try {
      setLoading(true);
      const redirectTo = Linking.createURL('auth/callback');
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setSent(true);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send magic link. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.content}>

            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={24} color="#F4D77A" />
              </Pressable>
              <Text style={styles.title}>Magic Link</Text>
              <View style={styles.backBtn} />
            </View>

            {sent ? (
              <View style={styles.sentState}>
                <View style={styles.sentIcon}>
                  <Ionicons name="mail-outline" size={40} color="#F4D77A" />
                </View>
                <Text style={styles.sentTitle}>Check your inbox</Text>
                <Text style={styles.sentSubtitle}>
                  We sent a login link to{'\n'}<Text style={styles.sentEmail}>{email}</Text>
                </Text>
                <Text style={styles.sentNote}>
                  Tap the link in the email to sign in. You can close this screen.
                </Text>
                <Pressable style={styles.resendBtn} onPress={() => setSent(false)}>
                  <Text style={styles.resendText}>Didn't get it? Send again</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a one-tap login link. No password needed.
                </Text>

                <BlurView intensity={90} tint="dark" style={styles.card}>
                  <CardOverlay />
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="jane@example.com"
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoFocus
                    />
                    {email.length > 0 && !isValidEmail(email) && (
                      <Text style={styles.errorText}>Please enter a valid email address.</Text>
                    )}
                  </View>
                </BlurView>

                <Reanimated.View style={breatheStyle}>
                  <Pressable
                    style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]}
                    onPress={handleSend}
                    disabled={loading}>
                    {loading
                      ? <BreathingHeart size={18} color="#09000F" />
                      : <Text style={styles.sendBtnText}>Send Magic Link</Text>
                    }
                  </Pressable>
                </Reanimated.View>
              </>
            )}

          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
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

  sendBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  sendBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },

  // Sent state
  sentState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  sentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sentTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: '#FFFFFF',
  },
  sentSubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },
  sentEmail: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },
  sentNote: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  resendBtn: { marginTop: Spacing.md },
  resendText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#F4D77A',
    textDecorationLine: 'underline',
  },
});
