/**
 * PIN Entry — biometric fallback shown from the unlock screen when the
 * user has a PIN set up (see /account-security) and biometrics fail or
 * are unavailable.
 */
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { verifyPin } from '@/lib/auth/pin';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationError, notificationSuccess } from '@/hooks/usePressHaptic';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function PinEntryScreen() {
  const { role } = useAuth();
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleDigit(d: string) {
    if (checking || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setChecking(true);
      const ok = await verifyPin(next);
      setChecking(false);
      if (ok) {
        notificationSuccess();
        router.replace(role === 'owner' ? '/(owner)/dashboard' : '/(tabs)/book');
      } else {
        notificationError();
        setPin('');
        Alert.alert('Incorrect PIN', 'Please try again.');
      }
    }
  }

  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Enter your PIN</Text>

        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <Pressable key={d} style={styles.key} onPress={() => handleDigit(d)} disabled={checking}>
              <Text style={styles.keyText}>{d}</Text>
            </Pressable>
          ))}
          <View style={styles.key} />
          <Pressable style={styles.key} onPress={() => handleDigit('0')} disabled={checking}>
            <Text style={styles.keyText}>0</Text>
          </Pressable>
          <Pressable style={styles.key} onPress={handleBackspace} disabled={checking}>
            <Ionicons name="backspace-outline" size={22} color={Colors.textPrimary} />
          </Pressable>
        </View>

        <Pressable style={styles.linkBtn} onPress={() => router.replace('/auth/sign-in')}>
          <Text style={styles.linkBtnText}>Use Password Instead</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  dotsRow: { flexDirection: 'row', gap: Spacing.md },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  dotFilled: { backgroundColor: Colors.primary },
  keypad: {
    width: 260,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  key: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card,
    ...Shadows.subtle,
  },
  keyText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  linkBtn: { marginTop: Spacing.md },
  linkBtnText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
