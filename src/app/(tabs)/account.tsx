import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Switch, ScrollView, Linking as RNLinking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  requestAndRegisterPushToken,
  getNotificationPermissionStatus,
  unregisterPushToken,
} from '@/lib/push/registerForPushNotifications';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { fetchMembershipStatus } from '@/lib/api/customer';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';

const BIOMETRICS_KEY = 'bwa_biometrics_enabled';

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [notifsEnabled, setNotifsEnabled] = useState(false);
  const [hasMembership, setHasMembership] = useState(false);

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
      fetchMembershipStatus().then(setHasMembership);
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
      <View style={styles.screen}>
        <DualBreathingBackground />

        <SafeAreaView style={styles.container}>
          <View style={styles.guestContent}>
            <Ionicons name="person-circle-outline" size={64} color='rgba(255,255,255,0.4)' />
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
              onPress={() => router.push('/auth/account-type')}>
              <Text style={styles.createBtnText}>Create Account</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={[styles.sparkle, { top: 2, left: 92, width: 3, height: 3 }]} />
        <View style={[styles.sparkle, { top: 18, left: 112, width: 2, height: 2 }]} />
        <View style={[styles.sparkle, { top: 30, left: 74, width: 2, height: 2 }]} />
        <View style={[styles.sparkle, { top: 8, left: 129, width: 2.5, height: 2.5 }]} />
      </View>

      <ScrollView style={styles.scrollFlex} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <Canvas style={styles.avatarGlow} pointerEvents="none">
              <Circle cx={40} cy={40} r={40}>
                <RadialGradient
                  c={vec(40, 40)}
                  r={40}
                  colors={['rgba(212,175,55,0.28)', 'rgba(123,63,228,0.05)', 'transparent']}
                />
              </Circle>
              <Circle cx={40} cy={40} r={30} style="stroke" strokeWidth={2} color="#F4D77A">
                <BlurMask blur={6} style="solid" />
              </Circle>
            </Canvas>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>
                {(user.user_metadata?.full_name || user.email || 'G')[0].toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user.user_metadata?.full_name || 'My Account'}
            </Text>
            {hasMembership && (
              <View style={styles.premiumBadge}>
                <Ionicons name="star" size={12} color="#F4D77A" />
                <Text style={styles.premiumBadgeText}>Premium Member</Text>
              </View>
            )}
            <Text style={styles.profileEmail}>{user.email}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.viewProfileLink, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/profile')}>
            <Text style={styles.viewProfileLinkText}>View Profile</Text>
            <Ionicons name="chevron-forward" size={14} color='rgba(255,255,255,0.4)' />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="finger-print-outline" size={20} color="#F4D77A" />
              <View>
                <Text style={styles.settingLabel}>Biometric Login</Text>
                <Text style={styles.settingDesc}>Use fingerprint or Face ID to unlock</Text>
              </View>
            </View>
            <Switch
              value={biometricsEnabled}
              onValueChange={handleToggleBiometrics}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#D4AF37' }}
              thumbColor={Colors.white}
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/account-security')}>
            <Text style={styles.linkLabel}>Password, Email & PIN</Text>
            <Ionicons name="chevron-forward" size={16} color='rgba(255,255,255,0.4)' />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color="#F4D77A" />
              <View>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDesc}>Booking confirmations and reminders</Text>
              </View>
            </View>
            <Switch
              value={notifsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#D4AF37' }}
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
            { label: 'Delete My Account', route: '/legal/delete-account' },
          ].map(({ label, route }) => (
            <Pressable
              key={route}
              style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(route as any)}>
              <Text style={styles.linkLabel}>{label}</Text>
              <Ionicons name="chevron-forward" size={16} color='rgba(255,255,255,0.4)' />
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#F09595" />
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </Pressable>

      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },

  container: { flex: 1, backgroundColor: 'transparent' },
  scrollFlex: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xl, paddingTop: 64, paddingBottom: 120, gap: Spacing.xl },

  guestContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  guestTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  guestSubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  createBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  headerTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: FontSize['2xl'] + 6,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  sparkle: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#F4D77A',
    shadowColor: '#F4D77A',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  profileHeader: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: -56,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  avatarWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: { position: 'absolute', width: 80, height: 80 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#F4D77A',
  },
  profileInfo: { alignItems: 'center', gap: 2 },
  profileName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  profileEmail: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  viewProfileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  viewProfileLinkText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },

  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  premiumBadgeText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: '#F4D77A',
  },

  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(212,175,55,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  settingLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  settingDesc: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  linkLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(226,74,74,0.1)',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(226,74,74,0.5)',
  },
  signOutBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F09595',
  },

});
