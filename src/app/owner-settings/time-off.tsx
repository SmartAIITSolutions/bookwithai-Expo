import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listTimeOff, createTimeOff, decideTimeOff, TimeOffEntry } from '@/lib/api/ownerTimeOff';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function statusColor(status: TimeOffEntry['status']) {
  if (status === 'approved') return Colors.success;
  if (status === 'denied') return Colors.error;
  return Colors.warning;
}

export default function TimeOffScreen() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<TimeOffEntry[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [entriesResult, staffResult] = await Promise.all([listTimeOff(), listStaff()]);
    if (entriesResult.ok) setEntries(entriesResult.data.data);
    if (staffResult.ok) setStaff(staffResult.data.data.filter(s => s.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!staffId || !startDate.trim() || !endDate.trim()) {
      Alert.alert('Missing info', 'Staff member, start date, and end date are all required.');
      return;
    }
    setSaving(true);
    const result = await createTimeOff({ staff_id: staffId, start_date: startDate.trim(), end_date: endDate.trim(), reason: reason.trim() || undefined });
    setSaving(false);
    if (result.ok) {
      setAdding(false); setStaffId(null); setStartDate(''); setEndDate(''); setReason('');
      load();
    } else {
      Alert.alert('Could not save', result.error);
    }
  }

  async function handleDecide(id: string, status: 'approved' | 'denied') {
    setDecidingId(id);
    const result = await decideTimeOff(id, status);
    setDecidingId(null);
    if (result.ok) load();
    else Alert.alert('Could not update', result.error);
  }

  const pending = entries.filter(e => e.status === 'pending');
  const decided = entries.filter(e => e.status !== 'pending');

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Time Off', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {pending.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Pending requests</Text>
              {pending.map(e => (
                <View key={e.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.staffName}>{e.staff?.name ?? 'Staff'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor(e.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: statusColor(e.status) }]}>Pending</Text>
                    </View>
                  </View>
                  <Text style={styles.dateRange}>{e.start_date} – {e.end_date}</Text>
                  {!!e.reason && <Text style={styles.reasonText}>{e.reason}</Text>}
                  <View style={styles.decideRow}>
                    {decidingId === e.id ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <>
                        <TouchableOpacity style={styles.denyBtn} onPress={() => handleDecide(e.id, 'denied')}>
                          <Text style={styles.denyBtnText}>Deny</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => handleDecide(e.id, 'approved')}>
                          <Text style={styles.approveBtnText}>Approve</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}

          <Text style={styles.sectionLabel}>{decided.length === 0 && pending.length === 0 ? '' : 'History'}</Text>
          {decided.length === 0 && pending.length === 0 && (
            <Text style={styles.emptyHint}>No time off recorded yet.</Text>
          )}
          {decided.map(e => (
            <View key={e.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.staffName}>{e.staff?.name ?? 'Staff'}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(e.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: statusColor(e.status) }]}>
                    {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                  </Text>
                </View>
              </View>
              <Text style={styles.dateRange}>{e.start_date} – {e.end_date}</Text>
              {!!e.reason && <Text style={styles.reasonText}>{e.reason}</Text>}
            </View>
          ))}

          {adding ? (
            <View style={styles.addCard}>
              <Text style={styles.fieldLabel}>Staff member</Text>
              <View style={styles.chipRow}>
                {staff.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.chip, staffId === s.id && styles.chipActive]}
                    onPress={() => setStaffId(s.id)}
                  >
                    <Text style={[styles.chipText, staffId === s.id && styles.chipTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={startDate} onChangeText={setStartDate} />
              <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={endDate} onChangeText={setEndDate} />
              <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor={Colors.textDisabled} value={reason} onChangeText={setReason} />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleCreate} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.addRowText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Set time off for a staff member</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.sm, textTransform: 'uppercase' },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 4, ...Shadows.subtle },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  staffName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  statusBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '700' },
  dateRange: { fontSize: 13, color: Colors.textPrimary },
  reasonText: { fontSize: 12.5, color: Colors.textSecondary },
  decideRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xs },
  denyBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: '#FEF2F2' },
  denyBtnText: { fontSize: 13, fontWeight: '700', color: Colors.error },
  approveBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary },
  approveBtnText: { fontSize: 13, fontWeight: '700', color: Colors.textOnPrimary },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundMain, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 12.5, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: Colors.textOnPrimary },
  input: { borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});
