import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { listCustomers, getMergeCandidates, CustomerLite } from '@/lib/api/ownerCustomers';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function money(cents: number | null | undefined) { return `$${((cents ?? 0) / 100).toFixed(2)}`; }

export default function OwnerCustomersScreen() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState(0);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const result = await listCustomers(q, 0, 50);
    if (result.ok) setCustomers(result.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(query); }, [load, query]);
  useEffect(() => {
    getMergeCandidates().then(r => { if (r.ok) setDuplicateGroups(r.data.groups.length); });
  }, []);

  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Customers" />
      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, or email"
          placeholderTextColor={Colors.textDisabled}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      {duplicateGroups > 0 && (
        <TouchableOpacity style={styles.duplicateBanner} onPress={() => router.push('/customer/merge-duplicates' as never)}>
          <Ionicons name="git-merge-outline" size={16} color={Colors.primary} />
          <Text style={styles.duplicateText}>{duplicateGroups} possible duplicate {duplicateGroups === 1 ? 'group' : 'groups'} — review</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyHint}>Your customer list starts here.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => router.push(`/customer/${item.id}` as never)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.phone ?? item.email ?? 'No contact info'}</Text>
              </View>
              <Text style={styles.rowSpend}>{money(item.total_spent_cents)}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg,
    backgroundColor: Colors.card, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8,
    marginBottom: Spacing.sm, ...Shadows.subtle,
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  duplicateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg,
    backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  duplicateText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing['2xl'] },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.subtle,
  },
  rowName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  rowMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  rowSpend: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
});
