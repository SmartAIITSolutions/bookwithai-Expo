import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable,
  Alert, Switch, ScrollView, Linking as RNLinking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  requestAndRegisterPushToken,
  getNotificationPermissionStatus,
  unregisterPushToken,
} from '@/lib/push/registerForPushNotifications';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const BIOMETRICS_KEY = 'bwa_biometrics_enabled';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(false);

  // Load biometrics preference on mount
  useState(() => {
    SecureStore.getItemAsync(BIOMETRICS_KEY).then((v) => {
      setBiometricsEnabled(v === 'true');
    });
  });

  // Re-check the real OS notification permission every time this tab is
  // focused — catches changes made in device Settings while the app was away.
  useFocusEffect(
    useCallback(() => {
      getNotificationPermissionStatus().then((status) => {
        setNotifsEnabled(status === 'granted');
      });
    }, [])
  );

  async function handleToggleNotifications(value: boolean) {
    if (value) {
      const granted = await requestAndRegisterPushToken();
      if (granted) {
        setNotifsEnabled(true);
      } else {
        // Already denied once — OS won't show the dialog again, send them to Settings.
        Alert.alert(
          'Enable in Settings',
          'Notifications are turned off for Book With AI. Open Settings to turn them on.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => RNLinking.openSettings() },
          ]
        );
      }
    } else {
      Alert.alert(
        'Turn off in Settings',
        'To stop notifications, turn them off for Book With AI in your device Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => RNLinking.openSettings() },
        ]
      );
    }
  }

  async function handleToggleBiometrics(value: boolean) {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled  = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Not available',
          'Biometric authentication is not set up on this device. Please enable it in your device settings first.'
        );
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify to enable biometric login',
      });
      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRICS_KEY, 'true');
        setBiometricsEnabled(true);
        Alert.alert('Enabled', 'Biometric login is now active.');
      }
    } else {
      await SecureStore.deleteItemAsync(BIOMETRICS_KEY);
      setBiometricsEnabled(false);
    }
  }

  async function handleSignOut() {
    Alert.alert(
      'Sign out?',
      "You'll need to sign in again to see your bookings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await unregisterPushToken();
            await signOut();
            router.replace('/auth');
          },
        },
      ]
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.guestContent}>
          <Ionicons name="person-circle-outline" size={64} color={Colors.textDisabled} />
          <Text style={styles.guestTitle}>Not signed in</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to manage your account and see your booking history.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/auth')}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/auth/sign-up')}>
            <Text style={styles.createBtnText}>Create Account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Pressable
          style={({ pressed }) => [styles.profileHeader, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/profile')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {(user.user_metadata?.full_name || user.email || 'G')[0].toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user.user_metadata?.full_name || 'My Account'}
            </Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textDisabled} />
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Biometric Login</Text>
                <Text style={styles.settingDesc}>Use fingerprint or Face ID to unlock</Text>
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/account-security')}>
            <Text style={styles.linkLabel}>Password, Email & PIN</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Booking confirmations and reminders</Text>
              </View>
            </View>
            <Switch
              value={notifsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          {[
            { label: 'Privacy Policy',   route: '/legal/privacy' },
            { label: 'Terms of Service', route: '/legal/terms' },
            { label: 'Support',          route: '/legal/support' },
            { label: 'Delete My Data',   route: '/legal/delete-account' },
          ].map(({ label, route }) => (
            <Pressable
              key={route}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(route as any)}>
              <Text style={styles.linkLabel}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  scroll: { padding: Spacing.xl, gap: Spacing.xl },

  guestContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  guestTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  guestSubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },
  signInBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  signInBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  createBtn: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  createBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.white,
  },
  profileInfo: { flex: 1, gap: 2 },
  profileName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  profileEmail: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  signOutBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.error,
  },

});
