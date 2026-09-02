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
import { useTranslation } from 'react-i18next';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

// Landed here right after a staff invite link establishes a session (see
// _layout.tsx). Links the account to its staff row, then requires a real
// password before entering the app (the invite session has no password set).
export default function StaffSetPasswordScreen() {
  const { t } = useTranslation(['auth', 'errors']);
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
      Alert.alert(t('errors:auth.passwordTooShortTitle'), t('errors:auth.useAtLeast8Chars'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('errors:auth.passwordsDontMatchTitle'), t('errors:auth.reenterToConfirm'));
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      Alert.alert(t('errors:auth.couldNotSetPasswordTitle'), error.message);
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
          <Text style={styles.title}>{t('auth:staffSetPassword.inviteExpiredTitle')}</Text>
          <Text style={styles.subtitle}>{linkError} {t('auth:staffSetPassword.askManagerToResend')}</Text>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace('/auth')}>
            <Text style={styles.secondaryBtnText}>{t('auth:staffSetPassword.backToSignIn')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.title}>{staffName ? t('auth:staffSetPassword.welcomeWithName', { name: staffName }) : t('auth:staffSetPassword.welcome')}</Text>
          <Text style={styles.subtitle}>{t('auth:staffSetPassword.subtitle')}</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('auth:staffSetPassword.passwordLabel')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth:staffSetPassword.passwordPlaceholder')}
              placeholderTextColor={Colors.textDisabled}
              secureTextEntry
              autoFocus
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>{t('auth:staffSetPassword.confirmLabel')}</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('auth:staffSetPassword.confirmPlaceholder')}
              placeholderTextColor={Colors.textDisabled}
              secureTextEntry
            />
          </View>

          <Pressable style={styles.primaryBtn} onPress={handleSetPassword} disabled={saving}>
            {saving ? <BreathingHeart size={18} color={Colors.white} /> : <Text style={styles.primaryBtnText}>{t('auth:staffSetPassword.continueButton')}</Text>}
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
