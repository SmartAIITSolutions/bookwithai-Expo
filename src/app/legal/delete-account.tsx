import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { deleteAccount } from '@/lib/api/customer';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

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
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Delete My Account', headerBackTitle: 'Account' }} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What gets deleted</Text>
            <Text style={styles.sectionDesc}>
              Your account, name, email, phone number, and saved profile details are permanently
              removed from Book With AI.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What salons keep, and why</Text>
            <Text style={styles.sectionDesc}>
              Salons you've booked with may be legally required to retain basic transaction
              records (like appointment and payment history) for accounting, tax, and
              fraud-prevention purposes. This is retained by the salon independently of your
              Book With AI account and is not accessible to you or us once your account is deleted.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Confirm deletion</Text>
            <Text style={styles.sectionDesc}>
              Type DELETE below to confirm. This action is permanent and cannot be undone.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={Colors.textDisabled}
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Pressable
              style={[styles.dangerBtnFull, !canDelete && styles.dangerBtnDisabled]}
              onPress={handleDelete}
              disabled={!canDelete || deleting}>
              <Ionicons name="trash-outline" size={18} color={canDelete ? Colors.error : Colors.textDisabled} />
              {deleting ? (
                <ActivityIndicator color={Colors.error} />
              ) : (
                <Text style={[styles.dangerBtnFullText, !canDelete && styles.dangerBtnTextDisabled]}>
                  Delete My Account
                </Text>
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
    lineHeight: FontSize.sm * 1.5,
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
  dangerBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.backgroundLavender,
  },
  dangerBtnFullText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.error,
  },
  dangerBtnTextDisabled: {
    color: Colors.textDisabled,
  },
});
