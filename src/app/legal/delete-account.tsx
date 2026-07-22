import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { useAuth } from '@/lib/auth/AuthContext';
import { deleteAccount } from '@/lib/api/customer';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

// Real in-app account deletion -- required by Apple Guideline 5.1.1(v),
// which does not accept an email/support-flow-only process (like the
// previous version of this screen, a link to a web page) for a
// non-regulated app. Typed "DELETE" confirmation matches the app's
// no-Alert.prompt rule (inline TextInput instead).
export default function DeleteAccountScreen() {
  const { signOut } = useAuth();
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  function handleDelete() {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your account and personal information. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteAccount();
            setDeleting(false);
            if (!result.ok) {
              Alert.alert('Could not delete account', result.error);
              return;
            }
            await signOut('local');
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
            title: 'Delete My Account',
            headerBackTitle: 'Account',
            headerStyle: { backgroundColor: '#09000F' },
            headerTintColor: '#F4D77A',
            headerTitleStyle: { color: '#FFFFFF' },
          }}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            <BlurView intensity={90} tint="dark" style={styles.section}>
              <LinearGradient
                colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.sectionTitle}>What gets deleted</Text>
              <Text style={styles.sectionDesc}>
                Your account, name, email, phone number, and saved profile details are permanently
                removed from Book With AI.
              </Text>
            </BlurView>

            <BlurView intensity={90} tint="dark" style={styles.section}>
              <LinearGradient
                colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.sectionTitle}>What salons keep, and why</Text>
              <Text style={styles.sectionDesc}>
                Salons you've booked with may be legally required to retain basic transaction
                records (like appointment and payment history) for accounting, tax, and
                fraud-prevention purposes. This is retained by the salon independently of your
                Book With AI account and is not accessible to you or us once your account is deleted.
              </Text>
            </BlurView>

            <BlurView intensity={90} tint="dark" style={styles.section}>
              <LinearGradient
                colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.sectionTitle}>Confirm deletion</Text>
              <Text style={styles.sectionDesc}>
                Type DELETE below to confirm. This action is permanent and cannot be undone.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Type DELETE to confirm"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={confirmText}
                onChangeText={setConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable
                style={[styles.dangerBtnFull, !canDelete && styles.dangerBtnDisabled]}
                onPress={handleDelete}
                disabled={!canDelete || deleting}>
                <Ionicons name="trash-outline" size={18} color={canDelete ? '#F09595' : 'rgba(255,255,255,0.3)'} />
                {deleting ? (
                  <BreathingHeart size={18} color="#F09595" />
                ) : (
                  <Text style={[styles.dangerBtnFullText, !canDelete && styles.dangerBtnTextDisabled]}>
                    Delete My Account
                  </Text>
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
    lineHeight: FontSize.sm * 1.5,
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
  dangerBtnDisabled: {
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dangerBtnFullText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F09595',
  },
  dangerBtnTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
  },
});
