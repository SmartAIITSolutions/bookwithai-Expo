import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { hasPin, setPin, clearPin } from '@/lib/auth/pin';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function AccountSecurityScreen() {
  const { t } = useTranslation(['auth', 'errors', 'common']);
  const { user, signOut } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [pinSet, setPinSet] = useState(false);
  const [settingPin, setSettingPin] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [savingPin, setSavingPin] = useState(false);

  const [signingOutAll, setSigningOutAll] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    hasPin().then(setPinSet);
  }, []);

  async function handleSaveEmail() {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      Alert.alert(t('errors:auth.invalidEmailTitle'), t('errors:auth.enterValidEmailAddress'));
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) {
      Alert.alert(t('errors:auth.couldNotUpdateEmailTitle'), error.message);
      return;
    }
    setNewEmail('');
    Alert.alert(t('errors:auth.checkInboxTitle'), t('errors:auth.confirmEmailChangeMessage'));
  }

  async function handleSavePassword() {
    if (newPassword.length < 8) {
      Alert.alert(t('errors:auth.passwordTooShortTitle'), t('errors:auth.useAtLeast8Chars'));
      return;
    }
    setSavingPassword(true);
    // Re-authenticate with the current password first so a stolen/unlocked
    // session can't silently change the password without knowing it.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? '',
      password: currentPassword,
    });
    if (reauthError) {
      setSavingPassword(false);
      Alert.alert(t('errors:auth.currentPasswordIncorrectTitle'), t('errors:auth.reenterCurrentPassword'));
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert(t('errors:auth.couldNotUpdatePasswordTitle'), error.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    Alert.alert(t('errors:auth.passwordUpdatedTitle'), t('errors:auth.passwordChangedMessage'));
  }

  async function handleSavePin() {
    if (pinDraft.length !== 4 || !/^\d{4}$/.test(pinDraft)) {
      Alert.alert(t('errors:auth.invalidPinTitle'), t('errors:auth.enter4DigitPin'));
      return;
    }
    if (pinDraft !== pinConfirm) {
      Alert.alert(t('errors:auth.pinsDontMatchTitle'), t('errors:auth.reenterToConfirm'));
      return;
    }
    setSavingPin(true);
    await setPin(pinDraft);
    setSavingPin(false);
    setPinDraft('');
    setPinConfirm('');
    setSettingPin(false);
    setPinSet(true);
    Alert.alert(t('errors:auth.pinSavedTitle'), t('errors:auth.pinSavedMessage'));
  }

  async function handleRemovePin() {
    Alert.alert(t('errors:auth.removePinTitle'), t('errors:auth.removePinMessage'), [
      { text: t('common:cancel'), style: 'cancel' },
      {
        text: t('auth:accountSecurity.removeButton'),
        style: 'destructive',
        onPress: async () => {
          await clearPin();
          setPinSet(false);
        },
      },
    ]);
  }

  function handleSignOutAllDevices() {
    Alert.alert(
      t('errors:auth.logOutAllTitle'),
      t('errors:auth.logOutAllMessage'),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('auth:accountSecurity.logOutEverywhereButton'),
          style: 'destructive',
          onPress: async () => {
            setSigningOutAll(true);
            await signOut('global');
            setSigningOutAll(false);
            router.replace('/auth');
          },
        },
      ]
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: t('auth:accountSecurity.headerTitle'),
          headerBackTitle: t('auth:accountSecurity.headerBackTitle'),
          headerStyle: { backgroundColor: '#09000F' },
          headerTintColor: '#F4D77A',
          headerTitleStyle: { color: '#FFFFFF' },
        }}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Change email */}
          <BlurView intensity={90} tint="dark" style={styles.section}>
            <CardOverlay />
            <Text style={styles.sectionTitle}>{t('auth:accountSecurity.changeEmailTitle')}</Text>
            <Text style={styles.sectionDesc}>{t('auth:accountSecurity.currentEmail', { email: user?.email })}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth:accountSecurity.newEmailPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable style={styles.primaryBtn} onPress={handleSaveEmail} disabled={savingEmail}>
              {savingEmail ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.primaryBtnText}>{t('auth:accountSecurity.updateEmailButton')}</Text>}
            </Pressable>
          </BlurView>

          {/* Change password */}
          <BlurView intensity={90} tint="dark" style={styles.section}>
            <CardOverlay />
            <Text style={styles.sectionTitle}>{t('auth:accountSecurity.changePasswordTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth:accountSecurity.currentPasswordPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder={t('auth:accountSecurity.newPasswordPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Pressable style={styles.primaryBtn} onPress={handleSavePassword} disabled={savingPassword}>
              {savingPassword ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.primaryBtnText}>{t('auth:accountSecurity.updatePasswordButton')}</Text>}
            </Pressable>
          </BlurView>

          {/* PIN fallback */}
          <BlurView intensity={90} tint="dark" style={styles.section}>
            <CardOverlay />
            <Text style={styles.sectionTitle}>{t('auth:accountSecurity.pinFallbackTitle')}</Text>
            <Text style={styles.sectionDesc}>
              {t('auth:accountSecurity.pinFallbackDesc')}
            </Text>

            {settingPin ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth:accountSecurity.newPinPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={pinDraft}
                  onChangeText={(v) => setPinDraft(v.replace(/\D/g, '').slice(0, 4))}
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth:accountSecurity.confirmPinPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  value={pinConfirm}
                  onChangeText={(v) => setPinConfirm(v.replace(/\D/g, '').slice(0, 4))}
                  onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
                <View style={styles.inlineActions}>
                  <Pressable onPress={() => { setSettingPin(false); setPinDraft(''); setPinConfirm(''); }}>
                    <Text style={styles.cancelText}>{t('auth:accountSecurity.cancel')}</Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtnSmall} onPress={handleSavePin} disabled={savingPin}>
                    {savingPin ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.primaryBtnText}>{t('auth:accountSecurity.savePinButton')}</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => setSettingPin(true)}>
                  <Text style={styles.secondaryBtnText}>{pinSet ? t('auth:accountSecurity.changePinButton') : t('auth:accountSecurity.setPinButton')}</Text>
                </Pressable>
                {pinSet && (
                  <Pressable style={styles.dangerBtn} onPress={handleRemovePin}>
                    <Text style={styles.dangerBtnText}>{t('auth:accountSecurity.removeButton')}</Text>
                  </Pressable>
                )}
              </View>
            )}
          </BlurView>

          {/* Sign out everywhere */}
          <BlurView intensity={90} tint="dark" style={styles.section}>
            <CardOverlay />
            <Text style={styles.sectionTitle}>{t('auth:accountSecurity.sessionsTitle')}</Text>
            <Pressable style={styles.dangerBtnFull} onPress={handleSignOutAllDevices} disabled={signingOutAll}>
              <Ionicons name="log-out-outline" size={18} color="#F09595" />
              {signingOutAll ? (
                <BreathingHeart size={18} color="#F09595" />
              ) : (
                <Text style={styles.dangerBtnFullText}>{t('auth:accountSecurity.logOutAllDevicesButton')}</Text>
              )}
            </Pressable>
          </BlurView>

        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: Spacing.xl, gap: Spacing.xl },

  section: {
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },
  sectionDesc: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sora,
    color: '#FFFFFF',
  },
  primaryBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnSmall: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.lg,
    marginTop: Spacing.xs,
  },
  cancelText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.6)',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  secondaryBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },
  dangerBtn: {
    backgroundColor: 'rgba(226,74,74,0.1)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,74,74,0.4)',
  },
  dangerBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F09595',
  },
  dangerBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(226,74,74,0.1)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(226,74,74,0.5)',
  },
  dangerBtnFullText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F09595',
  },
});
