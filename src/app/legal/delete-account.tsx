import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/AuthContext';
import { deleteAccount } from '@/lib/api/customer';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

// Real in-app account deletion -- required by Apple Guideline 5.1.1(v),
// which does not accept an email/support-flow-only process (like the
// previous version of this screen, a link to a web page) for a
// non-regulated app. Typed "DELETE" confirmation matches the app's
// no-Alert.prompt rule (inline TextInput instead). Shared between
// customer and owner accounts -- an owner deleting their login does NOT
// cascade-delete their salon (agency_clients/staff/bookings/customers,
// a separate table with no delete cascade to profiles), so they need a
// much stronger warning: this locks them out of that whole business
// permanently, not just their own personal profile.
export default function DeleteAccountScreen() {
  const { t } = useTranslation(['legal']);
  const { signOut, role } = useAuth();
  const isOwner = role === 'owner';
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmText.trim().toUpperCase() === 'DELETE';

  function handleDelete() {
    Alert.alert(
      isOwner ? t('legal:deleteAccount.deleteOwnerTitle') : t('legal:deleteAccount.deleteCustomerTitle'),
      isOwner
        ? t('legal:deleteAccount.deleteOwnerMessage')
        : t('legal:deleteAccount.deleteCustomerMessage'),
      [
        { text: t('legal:deleteAccount.cancel'), style: 'cancel' },
        {
          text: t('legal:deleteAccount.deleteAccountButton'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const result = await deleteAccount();
            setDeleting(false);
            if (!result.ok) {
              Alert.alert(t('legal:deleteAccount.couldNotDeleteTitle'), result.error);
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
            title: t('legal:deleteAccount.headerTitle'),
            headerBackTitle: t('legal:deleteAccount.headerBackTitle'),
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
              <Text style={styles.sectionTitle}>{t('legal:deleteAccount.whatGetsDeleted')}</Text>
              <Text style={styles.sectionDesc}>
                {t('legal:deleteAccount.whatGetsDeletedBody')}
              </Text>
            </BlurView>

            {isOwner ? (
              <BlurView intensity={90} tint="dark" style={[styles.section, styles.sectionWarning]}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[styles.sectionTitle, styles.sectionTitleWarning]}>{t('legal:deleteAccount.whatDoesNotDelete')}</Text>
                <Text style={styles.sectionDesc}>
                  {t('legal:deleteAccount.whatDoesNotDeleteBody')}
                </Text>
              </BlurView>
            ) : (
              <BlurView intensity={90} tint="dark" style={styles.section}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.sectionTitle}>{t('legal:deleteAccount.whatSalonsKeep')}</Text>
                <Text style={styles.sectionDesc}>
                  {t('legal:deleteAccount.whatSalonsKeepBody')}
                </Text>
              </BlurView>
            )}

            <BlurView intensity={90} tint="dark" style={styles.section}>
              <LinearGradient
                colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.sectionTitle}>{t('legal:deleteAccount.confirmDeletion')}</Text>
              <Text style={styles.sectionDesc}>
                {t('legal:deleteAccount.confirmDeletionBody')}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t('legal:deleteAccount.typeDeleteToConfirm')}
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
                    {t('legal:deleteAccount.deleteMyAccount')}
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
  sectionWarning: {
    borderColor: 'rgba(226,74,74,0.5)',
    backgroundColor: 'rgba(226,74,74,0.08)',
  },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },
  sectionTitleWarning: {
    color: '#F09595',
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
