import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchStaffCommissions, StaffCommissionEntry } from '@/lib/api/staffApi';
import { InvisibleRefreshControl, RefreshHeartOverlay } from '@/components/PullToRefreshHeart';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function StaffEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<StaffCommissionEntry[]>([]);
  const [totalCents, setTotalCents] = useState(0);

  const load = useCallback(async () => {
    const result = await fetchStaffCommissions();
    if (result.ok) {
      setEntries(result.data.data);
      setTotalCents(result.data.total_cents);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Earnings</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <View style={{ flex: 1 }}>
          <RefreshHeartOverlay refreshing={refreshing} />
          <FlatList
            style={{ flex: 1 }}
            data={entries}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<InvisibleRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            ListHeaderComponent={
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Total commission earned</Text>
                <Text style={styles.totalValue}>{formatPrice(totalCents)}</Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="cash-outline" size={40} color={Colors.textDisabled} />
                <Text style={styles.emptyHint}>No commission earned yet.</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
                  <Text style={styles.cardAmount}>{formatPrice(item.amount_cents)}</Text>
                </View>
                <Text style={styles.cardRate}>{item.rate_pct_used}% rate</Text>
              </View>
            )}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: Colors.textPrimary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.xl, gap: Spacing.md },
  totalCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: 4, marginBottom: Spacing.md, ...Shadows.card },
  totalLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: Colors.primary },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xl },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textSecondary },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 2, borderWidth: 1, borderColor: Colors.border, ...Shadows.subtle },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textPrimary },
  cardAmount: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: Colors.primary },
  cardRate: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: Colors.textDisabled },
});
