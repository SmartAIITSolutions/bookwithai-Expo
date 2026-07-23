import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { FontFamily } from '@/constants/Theme';
import { Stack, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { getMergeCandidates, mergeCustomers, CustomerLite } from '@/lib/api/ownerCustomers';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

// The audit found merge logic that only ever fired silently during public
// booking (phone/email match) — no owner-facing "detect & merge" action
// existed anywhere. This is that action.
export default function MergeDuplicatesScreen() {
  const [groups, setGroups] = useState<CustomerLite[][]>([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await getMergeCandidates();
    if (result.ok) setGroups(result.data.groups);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleMerge(group: CustomerLite[]) {
    const key = group.map(c => c.id).join(',');
    Alert.alert(
      'Merge these customers?',
      `${group.map(c => c.name).join(', ')} will become one customer record. Their booking history, spend, and loyalty combine — this cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Merge', onPress: async () => {
          setMerging(key);
          const result = await mergeCustomers(group.map(c => c.id));
          setMerging(null);
          if (result.ok) load();
          else Alert.alert('Could not merge', result.error);
        }},
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Merge Duplicates' }} />
        <BreathingHeart size={40} color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Merge Duplicates', headerBackTitle: 'Customers' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {groups.length === 0 && (
          <Text style={styles.emptyHint}>No duplicate customers found — nothing to review.</Text>
        )}
        {groups.map(group => {
          const key = group.map(c => c.id).join(',');
          return (
            <View key={key} style={styles.card}>
              {group.map(c => (
                <View key={c.id} style={styles.customerRow}>
                  <Text style={styles.customerName}>{c.name}</Text>
                  <Text style={styles.customerMeta}>{c.phone ?? c.email ?? '—'} · {c.total_bookings ?? 0} visits</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.mergeButton} onPress={() => handleMerge(group)} disabled={merging === key}>
                {merging === key ? <BreathingHeart size={18} color={Colors.textOnPrimary} /> : <Text style={styles.mergeButtonText}>Merge into one</Text>}
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing['2xl'] },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.xs, ...Shadows.subtle },
  customerRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  customerName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  customerMeta: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  mergeButton: { backgroundColor: Colors.buttonPrimaryBg, borderRadius: BorderRadius.sm, paddingVertical: 10, alignItems: 'center', marginTop: Spacing.xs },
  mergeButtonText: { color: Colors.buttonPrimaryText, fontSize: 14, fontWeight: '700' },
});
