import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { AIInsightSlot } from '@/components/owner/AIInsightSlot';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

// Sprint 0 shell only — Business Health Score, Today's Snapshot, Next
// Appointment, Timeline, and Quick Actions (Phase 0.2) land in Sprint 5.
export default function OwnerDashboardScreen() {
  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Dashboard" />
      <ScrollView contentContainerStyle={styles.content}>
        <AIInsightSlot message={null} />
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>You're all set up.</Text>
          <Text style={styles.emptyBody}>
            Your dashboard fills in as appointments, staff, and services come online.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  content: { padding: Spacing.lg, gap: Spacing.md },
  emptyState: { paddingTop: Spacing['2xl'], alignItems: 'center', gap: Spacing.xs },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
});
