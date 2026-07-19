import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { useAuth } from '@/lib/auth/AuthContext';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

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

  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="More" onNotificationsPress={() => router.push('/owner-notifications' as never)} />
      <ScrollView contentContainerStyle={styles.content}>
        {GROUPS.map((group) => (
          <View key={group.name} style={styles.group}>
            <Text style={styles.groupLabel}>{group.name}</Text>
            <View style={styles.card}>
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  disabled={!item.route}
                  onPress={() => item.route && router.push(item.route as never)}
                  style={[styles.row, i > 0 && styles.rowBorder]}
                >
                  <Text style={[styles.rowText, !item.route && styles.rowTextDisabled]}>{item.label}</Text>
                  {item.route ? (
                    <Ionicons name="chevron-forward" size={16} color={Colors.textDisabled} />
                  ) : (
                    <View style={styles.soonBadge}>
                      <Text style={styles.soonBadgeText}>Coming Soon</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={() => signOut()}>
            <Text style={styles.rowText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  group: { gap: Spacing.xs },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    ...Shadows.subtle,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: Spacing.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowText: { fontSize: 15, color: Colors.textPrimary },
  rowTextDisabled: { color: Colors.textDisabled },
  soonBadge: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  soonBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary,
  },
});
