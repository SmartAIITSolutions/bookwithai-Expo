import { View, Text, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

// Sprint 0 shell only — Day-view calendar, status colors, gestures, and the
// appointment bottom sheet (Phase 0.3/0.4) land in Sprint 2.
export default function OwnerCalendarScreen() {
  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Calendar" />
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Your calendar is ready to fill up.</Text>
        <Text style={styles.emptyBody}>Appointments will appear here once booking is connected.</Text>
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
