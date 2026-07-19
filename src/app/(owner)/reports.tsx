import { router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';

// Sprint 0 shell only — revenue/appointment/staff reporting (Phase 0.1
// Reports tab) is not part of Sprint 5's locked scope (Dashboard +
// Notifications only) -- lands in Sprint 10 per the Sprint Schedule.
// (Corrected 2026-07-17: this comment previously said "Sprint 5 (basics)",
// which didn't match the locked schedule.)
export default function OwnerReportsScreen() {
  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Reports" onNotificationsPress={() => router.push('/owner-notifications' as never)} />
      <View style={styles.emptyState}>
        <View style={styles.soonBadge}>
          <Text style={styles.soonBadgeText}>Coming Soon</Text>
        </View>
        <Text style={styles.emptyTitle}>Reports isn't built yet.</Text>
        <Text style={styles.emptyBody}>
          Revenue, appointments, and staff performance reporting is on the roadmap — your
          bookings and revenue data are already being tracked and will show up here once
          this feature ships.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.sm },
  soonBadge: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: Spacing.xs,
  },
  soonBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
