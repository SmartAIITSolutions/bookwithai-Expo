import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTranslation } from 'react-i18next';
import { LanguagePickerRow } from '@/components/LanguagePickerRow';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Phase 0.1 "More" menu — grouped by how often it's used, not how important
// it is. Every item here must be real and tappable -- unbuilt features are
// left out of this list entirely rather than shown as a disabled "Coming
// Soon" row (an App Store review risk: a menu that's mostly dead ends reads
// as incomplete). Growth/AI/Hardware groups previously existed here as
// all-placeholder groups and are removed entirely for the same reason;
// they come back once there's a real screen behind at least one item.
function buildGroups(t: ReturnType<typeof useTranslation<['owner']>>['t']): { name: string; items: { label: string; route: string }[] }[] {
  return [
    { name: t('owner:moreScreen.businessGroup'), items: [
      { label: t('owner:moreScreen.services'), route: '/owner-settings/services' },
      { label: t('owner:moreScreen.products'), route: '/owner-settings/products' },
      { label: t('owner:moreScreen.membershipPlans'), route: '/owner-settings/membership-plans' },
      { label: t('owner:moreScreen.packages'), route: '/owner-settings/service-packages' },
    ] },
    { name: t('owner:moreScreen.teamGroup'), items: [
      { label: t('owner:moreScreen.staff'), route: '/owner-settings/staff' },
      { label: t('owner:moreScreen.timeOff'), route: '/owner-settings/time-off' },
      { label: t('owner:moreScreen.clockInPayroll'), route: '/owner-settings/clock' },
    ] },
    { name: t('owner:moreScreen.systemGroup'), items: [
      { label: t('owner:moreScreen.settings'), route: '/owner-settings/business' },
      { label: t('owner:moreScreen.payments'), route: '/owner-settings/payments' },
      { label: t('owner:moreScreen.reports'), route: '/owner-settings/reports' },
      { label: t('owner:moreScreen.reviews'), route: '/reviews' },
    ] },
    { name: t('owner:moreScreen.legalGroup'), items: [
      { label: t('owner:moreScreen.privacyPolicy'), route: '/legal/privacy' },
      { label: t('owner:moreScreen.termsOfService'), route: '/legal/terms' },
      { label: t('owner:moreScreen.support'), route: '/legal/support' },
      { label: t('owner:moreScreen.deleteMyAccount'), route: '/legal/delete-account' },
    ] },
  ];
}

export default function OwnerMoreScreen() {
  const { t } = useTranslation(['owner']);
  const { signOut } = useAuth();
  const { width, height } = useWindowDimensions();
  const GROUPS = buildGroups(t);

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <OwnerScreenHeader title={t('owner:moreScreen.title')} onNotificationsPress={() => router.push('/owner-notifications' as never)} />
      <ScrollView contentContainerStyle={styles.content}>
        {GROUPS.map((group, gi) => (
          <View key={`group-${gi}`} style={styles.group}>
            <Text style={styles.groupLabel}>{group.name}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={`item-${gi}-${i}`}
                  onPress={() => router.push(item.route as never)}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                >
                  <Text style={styles.rowText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
                </TouchableOpacity>
              ))}
            </BlurView>
          </View>
        ))}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>{t('owner:moreScreen.languageGroup')}</Text>
          <BlurView intensity={90} tint="dark" style={[styles.card, styles.languageCard]}>
            <CardOverlay />
            <LanguagePickerRow variant="dark" />
          </BlurView>
        </View>
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <TouchableOpacity style={styles.row} onPress={() => signOut()}>
            <Text style={styles.logOutText}>{t('owner:moreScreen.logOut')}</Text>
          </TouchableOpacity>
        </BlurView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 110 },
  group: { gap: Spacing.xs },
  groupLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#F4D77A',
    marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: Spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  languageCard: { padding: Spacing.md },
  rowText: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF' },
  logOutText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FF6B6B' },
});
