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
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function MagicLinkScreen() {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);

  async function handleSend() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please type your email address to receive a magic link.');
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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>

          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.title}>Magic Link</Text>
            <View style={styles.backBtn} />
          </View>

          {sent ? (
            <View style={styles.sentState}>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-outline" size={40} color={Colors.primary} />
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
              </View>

              <Pressable
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.85 }]}
                onPress={handleSend}
                disabled={loading}>
                {loading
                  ? <ActivityIndicator color={Colors.white} />
                  : <Text style={styles.sendBtnText}>Send Magic Link</Text>
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

  // Sent state
  sentState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  sentIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundLavender,
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
    lineHeight: FontSize.base * 1.6,
  },
  sentEmail: { fontFamily: FontFamily.soraSemiBold, color: Colors.textPrimary },
  sentNote: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    textAlign: 'center',
  },
  resendBtn: { marginTop: Spacing.md },
  resendText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
