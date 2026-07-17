import { View, Text, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

// Sprint 0 shell only — revenue/appointment/staff reporting (Phase 0.1 Reports
// tab) lands in Sprint 5 (basics) and Sprint 10 (exports/forecasting seed).
export default function OwnerReportsScreen() {
  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Reports" />
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
