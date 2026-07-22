import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { useAuth } from '@/lib/auth/AuthContext';
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
// it is. Groups and items are locked; screens behind each item land in the
// sprint that owns that feature (see MASTER.md Sprint Schedule). Items
// without a `route` are placeholders for future sprints, not yet tappable.
const GROUPS: { name: string; items: { label: string; route?: string }[] }[] = [
  { name: 'Business', items: [
    { label: 'Services', route: '/owner-settings/services' },
    { label: 'Products', route: '/owner-settings/products' },
    { label: 'Membership Plans', route: '/owner-settings/membership-plans' },
    { label: 'Packages', route: '/owner-settings/service-packages' },
    { label: 'Inventory' }, { label: 'Expenses' }, { label: 'Taxes' },
  ] },
  { name: 'Team', items: [
    { label: 'Staff', route: '/owner-settings/staff' },
    { label: 'Time Off', route: '/owner-settings/time-off' },
    { label: 'Clock In / Payroll', route: '/owner-settings/clock' },
    { label: 'Permissions' },
  ] },
  { name: 'Growth', items: [
    { label: 'Marketing' }, { label: 'Reviews' }, { label: 'Campaigns' }, { label: 'Referrals' }, { label: 'Promotions' },
  ] },
  { name: 'AI', items: [
    { label: 'SANAA' }, { label: 'Automation' }, { label: 'Insights' }, { label: 'Voice Calls' }, { label: 'AI Rules' },
  ] },
  { name: 'Hardware', items: [
    { label: 'POS' }, { label: 'Printer' }, { label: 'Scanner' }, { label: 'Terminal' }, { label: 'Cash Drawer' }, { label: 'Customer Display' },
  ] },
  { name: 'System', items: [
    { label: 'Settings', route: '/owner-settings/business' },
    { label: 'Support' }, { label: 'About' }, { label: 'Legal' },
  ] },
];

export default function OwnerMoreScreen() {
  const { signOut } = useAuth();
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <OwnerScreenHeader title="More" onNotificationsPress={() => router.push('/owner-notifications' as never)} />
      <ScrollView contentContainerStyle={styles.content}>
        {GROUPS.map((group) => (
          <View key={group.name} style={styles.group}>
            <Text style={styles.groupLabel}>{group.name}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  disabled={!item.route}
                  onPress={() => item.route && router.push(item.route as never)}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                >
                  <Text style={[styles.rowText, !item.route && styles.rowTextDisabled]}>{item.label}</Text>
                  {item.route ? (
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
                  ) : (
                    <View style={styles.soonBadge}>
                      <Text style={styles.soonBadgeText}>Coming Soon</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </BlurView>
          </View>
        ))}
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <TouchableOpacity style={styles.row} onPress={() => signOut()}>
            <Text style={styles.logOutText}>Log Out</Text>
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
  rowText: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF' },
  rowTextDisabled: { color: 'rgba(255,255,255,0.35)' },
  logOutText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FF6B6B' },
  soonBadge: {
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  soonBadgeText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: 11,
    color: '#F4D77A',
  },
});
