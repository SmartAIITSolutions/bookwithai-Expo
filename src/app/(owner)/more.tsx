import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { useAuth } from '@/lib/auth/AuthContext';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

// Phase 0.1 "More" menu — grouped by how often it's used, not how important
// it is. Groups and items are locked; screens behind each item land in the
// sprint that owns that feature (see MASTER.md Sprint Schedule).
const GROUPS: { name: string; items: string[] }[] = [
  { name: 'Business', items: ['Services', 'Products', 'Inventory', 'Expenses', 'Taxes'] },
  { name: 'Team',     items: ['Staff', 'Schedules', 'Payroll', 'Permissions'] },
  { name: 'Growth',   items: ['Marketing', 'Reviews', 'Campaigns', 'Referrals', 'Promotions'] },
  { name: 'AI',       items: ['SANAA', 'Automation', 'Insights', 'Voice Calls', 'AI Rules'] },
  { name: 'Hardware', items: ['POS', 'Printer', 'Scanner', 'Terminal', 'Cash Drawer', 'Customer Display'] },
  { name: 'System',   items: ['Settings', 'Support', 'About', 'Legal'] },
];

export default function OwnerMoreScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="More" />
      <ScrollView contentContainerStyle={styles.content}>
        {GROUPS.map((group) => (
          <View key={group.name} style={styles.group}>
            <Text style={styles.groupLabel}>{group.name}</Text>
            <View style={styles.card}>
              {group.items.map((item, i) => (
                <View key={item} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <Text style={styles.rowText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
        <View style={styles.card}>
          <Text style={styles.rowText} onPress={signOut}>Log Out</Text>
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
  row: { paddingVertical: 14, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowText: { fontSize: 15, color: Colors.textPrimary },
});
