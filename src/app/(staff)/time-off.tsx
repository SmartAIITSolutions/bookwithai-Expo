import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchStaffTimeOff, requestStaffTimeOff, StaffTimeOffEntry } from '@/lib/api/staffApi';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

function statusColor(status: StaffTimeOffEntry['status']) {
  if (status === 'approved') return Colors.success;
  if (status === 'denied') return Colors.error;
  return Colors.warning;
}

export default function StaffTimeOffScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [entries, setEntries] = useState<StaffTimeOffEntry[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchStaffTimeOff();
    if (result.ok) setEntries(result.data.data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleSubmit() {
    if (!startDate.trim() || !endDate.trim()) {
      Alert.alert('Missing dates', 'Enter a start and end date.');
      return;
    }
    setSaving(true);
    const result = await requestStaffTimeOff({ start_date: startDate.trim(), end_date: endDate.trim(), reason: reason.trim() || undefined });
    setSaving(false);
    if (result.ok) {
      setRequesting(false); setStartDate(''); setEndDate(''); setReason('');
      load();
    } else {
      Alert.alert('Could not submit request', result.error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Time Off</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator color={Colors.primary} size="large" /></View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListHeaderComponent={
            requesting ? (
              <View style={styles.requestCard}>
                <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={startDate} onChangeText={setStartDate} />
                <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={endDate} onChangeText={setEndDate} />
                <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor={Colors.textDisabled} value={reason} onChangeText={setReason} />
                <View style={styles.requestActions}>
                  <Pressable onPress={() => setRequesting(false)}><Text style={styles.cancelText}>Cancel</Text></Pressable>
                  <Pressable onPress={handleSubmit} disabled={saving}>
                    {saving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.addRowText}>Submit request</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={styles.addRow} onPress={() => setRequesting(true)}>
                <Ionicons name="add" size={18} color={Colors.primary} />
                <Text style={styles.addRowText}>Request time off</Text>
              </Pressable>
            )
          }
          ListEmptyComponent={<Text style={styles.emptyHint}>No time off requested yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.dateRange}>{item.start_date} – {item.end_date}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
              {!!item.reason && <Text style={styles.reasonText}>{item.reason}</Text>}
            </View>
          )}
        />
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
  emptyHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  addRowText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: Colors.primary },
  requestCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md, ...Shadows.subtle },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 10, fontFamily: FontFamily.sora, fontSize: FontSize.base, color: Colors.textPrimary },
  requestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: Colors.textSecondary },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 4, borderWidth: 1, borderColor: Colors.border, ...Shadows.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateRange: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: Colors.textPrimary },
  statusBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs },
  reasonText: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: Colors.textSecondary },
});
