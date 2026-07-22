import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BreathingHeart } from '@/components/BreathingHeart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { linkStaffInvite } from '@/lib/api/staffApi';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

// Landed here right after a staff invite link establishes a session (see
// _layout.tsx). Links the account to its staff row, then requires a real
// password before entering the app (the invite session has no password set).
export default function StaffSetPasswordScreen() {
  const { refreshProfile } = useAuth();
  const [linking, setLinking] = useState(true);
  const [staffName, setStaffName] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    linkStaffInvite().then((result) => {
      setLinking(false);
      if (result.ok) setStaffName(result.data.staffName);
      else setLinkError(result.error);
    });
  }, []);

  async function handleSetPassword() {
    if (password.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
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
      Alert.alert('Could not set password', error.message);
      return;
    }
    await refreshProfile();
    router.replace('/(staff)/schedule');
  }

  if (linking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <BreathingHeart size={40} color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (linkError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.title}>Invite link expired</Text>
          <Text style={styles.subtitle}>{linkError} Ask your manager to resend the invite.</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/auth')}>
            <Text style={styles.secondaryBtnText}>Back to Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome{staffName ? `, ${staffName}` : ''}</Text>
          <Text style={styles.subtitle}>Set a password to finish creating your account.</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={Colors.textDisabled}
              secureTextEntry
              autoFocus
            />
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
            />
          </View>

          <Pressable style={styles.primaryBtn} onPress={handleSetPassword} disabled={saving}>
            {saving ? <BreathingHeart size={18} color={Colors.white} /> : <Text style={styles.primaryBtnText}>Continue</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  content: { flex: 1, padding: Spacing.xl, justifyContent: 'center', gap: Spacing.lg },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: Colors.textPrimary, textAlign: 'center' },
  subtitle: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: FontSize.base * 1.6 },
  fieldGroup: { gap: Spacing.xs },
  label: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontFamily: FontFamily.sora, fontSize: FontSize.base, color: Colors.textPrimary,
  },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, alignItems: 'center', ...Shadows.button },
  primaryBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: Colors.white },
  secondaryBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  secondaryBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: Colors.primary },
});
