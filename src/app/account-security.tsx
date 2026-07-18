import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { hasPin, setPin, clearPin } from '@/lib/auth/pin';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function AccountSecurityScreen() {
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

  useEffect(() => {
    hasPin().then(setPinSet);
  }, []);

  async function handleSaveEmail() {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) {
      Alert.alert('Could not update email', error.message);
      return;
    }
    setNewEmail('');
    Alert.alert('Check your inbox', 'Confirm the change from the link sent to your new email address.');
  }

  async function handleSavePassword() {
    if (newPassword.length < 8) {
      Alert.alert('Password too short', 'Use at least 8 characters.');
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
      Alert.alert('Current password incorrect', 'Please re-enter your current password.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Could not update password', error.message);
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    Alert.alert('Password updated', 'Your password has been changed.');
  }

  async function handleSavePin() {
    if (pinDraft.length !== 4 || !/^\d{4}$/.test(pinDraft)) {
      Alert.alert('Invalid PIN', 'Enter a 4-digit PIN.');
      return;
    }
    if (pinDraft !== pinConfirm) {
      Alert.alert("PINs don't match", 'Please re-enter to confirm.');
      return;
    }
    setSavingPin(true);
    await setPin(pinDraft);
    setSavingPin(false);
    setPinDraft('');
    setPinConfirm('');
    setSettingPin(false);
    setPinSet(true);
    Alert.alert('PIN saved', 'You can now use your PIN as a fallback for biometric login.');
  }

  async function handleRemovePin() {
    Alert.alert('Remove PIN?', 'You will no longer be able to use a PIN as a biometric fallback.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
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
      'Log out of all devices?',
      "You'll be signed out everywhere, including this device.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out Everywhere',
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
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Account Security', headerBackTitle: 'Account' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Change email */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Email</Text>
            <Text style={styles.sectionDesc}>Current: {user?.email}</Text>
            <TextInput
              style={styles.input}
              placeholder="New email address"
              placeholderTextColor={Colors.textDisabled}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Pressable style={styles.primaryBtn} onPress={handleSaveEmail} disabled={savingEmail}>
              {savingEmail ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Update Email</Text>}
            </Pressable>
          </View>

          {/* Change password */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor={Colors.textDisabled}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={Colors.textDisabled}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <Pressable style={styles.primaryBtn} onPress={handleSavePassword} disabled={savingPassword}>
              {savingPassword ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Update Password</Text>}
            </Pressable>
          </View>

          {/* PIN fallback */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PIN Fallback</Text>
            <Text style={styles.sectionDesc}>
              A 4-digit PIN you can use to unlock the app if biometrics fail.
            </Text>

            {settingPin ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="New 4-digit PIN"
                  placeholderTextColor={Colors.textDisabled}
                  value={pinDraft}
                  onChangeText={(t) => setPinDraft(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm PIN"
                  placeholderTextColor={Colors.textDisabled}
                  value={pinConfirm}
                  onChangeText={(t) => setPinConfirm(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                />
                <View style={styles.inlineActions}>
                  <Pressable onPress={() => { setSettingPin(false); setPinDraft(''); setPinConfirm(''); }}>
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={styles.primaryBtnSmall} onPress={handleSavePin} disabled={savingPin}>
                    {savingPin ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.primaryBtnText}>Save PIN</Text>}
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.inlineActions}>
                <Pressable style={styles.secondaryBtn} onPress={() => setSettingPin(true)}>
                  <Text style={styles.secondaryBtnText}>{pinSet ? 'Change PIN' : 'Set a PIN'}</Text>
                </Pressable>
                {pinSet && (
                  <Pressable style={styles.dangerBtn} onPress={handleRemovePin}>
                    <Text style={styles.dangerBtnText}>Remove</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Sign out everywhere */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sessions</Text>
            <Pressable style={styles.dangerBtnFull} onPress={handleSignOutAllDevices} disabled={signingOutAll}>
              <Ionicons name="log-out-outline" size={18} color={Colors.error} />
              {signingOutAll ? (
                <ActivityIndicator color={Colors.error} />
              ) : (
                <Text style={styles.dangerBtnFullText}>Log Out of All Devices</Text>
              )}
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  scroll: { padding: Spacing.xl, gap: Spacing.xl },

  section: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  sectionDesc: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    fontSize: FontSize.base,
    fontFamily: FontFamily.sora,
    color: Colors.textPrimary,
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  primaryBtnSmall: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
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
    color: Colors.textSecondary,
  },
  secondaryBtn: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  secondaryBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },
  dangerBtn: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  dangerBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.error,
  },
  dangerBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  dangerBtnFullText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.error,
  },
});
