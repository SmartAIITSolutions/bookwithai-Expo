import { router } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

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
        <Text style={styles.emptyTitle}>Your numbers will show up here.</Text>
        <Text style={styles.emptyBody}>Revenue, appointments, and staff performance, once there's data to show.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, gap: Spacing.xs },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
