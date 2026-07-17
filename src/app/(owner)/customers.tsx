import { View, Text, StyleSheet } from 'react-native';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

// Sprint 0 shell only — Customer Directory / CRM (Phase 0.5) lands in Sprint 3.
export default function OwnerCustomersScreen() {
  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Customers" />
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>Your customer list starts here.</Text>
        <Text style={styles.emptyBody}>Every customer you serve will build a profile here automatically.</Text>
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
