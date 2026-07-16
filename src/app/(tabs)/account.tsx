import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const ONBOARDING_KEY = 'bwa_onboarding_done';

// PLACEHOLDER — Step 5 will build the real phone OTP auth + profile screen
export default function AccountScreen() {
  async function handleResetOnboarding() {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    Alert.alert('Reset!', 'Onboarding cleared. Restart the app to see it again.', [
      { text: 'Go to Onboarding now', onPress: () => router.replace('/onboarding') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Sign in with your phone number to manage your account.</Text>

        {/* ⚠️ DEV ONLY — remove before store submission */}
        <View style={styles.devSection}>
          <Text style={styles.devLabel}>⚠️ DEV TOOLS — REMOVE BEFORE SUBMISSION</Text>
          <Pressable style={styles.devBtn} onPress={handleResetOnboarding}>
            <Text style={styles.devBtnText}>Reset Onboarding</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 28,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.sora,
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  devSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xl,
    width: '100%',
  },
  devLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: Colors.warning,
    textAlign: 'center',
  },
  devBtn: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  devBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.warning,
  },
});
