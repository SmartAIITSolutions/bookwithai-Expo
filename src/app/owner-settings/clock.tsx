import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { FontFamily } from '@/constants/Theme';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { listShifts, clockStaff, ShiftEntry } from '@/lib/api/ownerShifts';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function formatTime(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Kiosk: staff tap their name + enter a 4-digit PIN on this shared device
// to clock in/out. The owner's own session authorizes the request; the
// PIN just confirms which staff member it is (shared_device mode).
export default function ClockKioskScreen() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [openShifts, setOpenShifts] = useState<ShiftEntry[]>([]);
  const [recentShifts, setRecentShifts] = useState<ShiftEntry[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [staffResult, openResult, recentResult] = await Promise.all([
      listStaff(), listShifts({ openOnly: true }), listShifts(),
    ]);
    if (staffResult.ok) setStaff(staffResult.data.data.filter(s => s.active));
    if (openResult.ok) setOpenShifts(openResult.data.data);
    if (recentResult.ok) setRecentShifts(recentResult.data.data.slice(0, 15));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openStaffIds = new Set(openShifts.map(s => s.staff_id));

  function handleSelectStaff(id: string) {
    setSelectedStaffId(id);
    setPin('');
  }

  async function handleDigit(d: string) {
    if (submitting || pin.length >= 4 || !selectedStaffId) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) {
      setSubmitting(true);
      const action = openStaffIds.has(selectedStaffId) ? 'out' : 'in';
      const result = await clockStaff(selectedStaffId, next, action);
      setSubmitting(false);
      setPin('');
      if (result.ok) {
        setSelectedStaffId(null);
        load();
      } else {
        Alert.alert('Could not clock in/out', result.error);
      }
    }
  }

  function handleBackspace() {
    setPin(p => p.slice(0, -1));
  }

  const selectedStaff = staff.find(s => s.id === selectedStaffId);

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: 'Clock In / Payroll', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.sectionLabel}>Who's clocking in?</Text>
          <View style={styles.chipRow}>
            {staff.map(s => {
              const isOpen = openStaffIds.has(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.staffChip, selectedStaffId === s.id && styles.staffChipActive, isOpen && styles.staffChipOpen]}
                  onPress={() => handleSelectStaff(s.id)}
                >
                  <Text style={[styles.staffChipText, selectedStaffId === s.id && styles.staffChipTextActive]}>
                    {s.name}{isOpen ? ' • On clock' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {selectedStaff && (
            <View style={styles.pinCard}>
              <Text style={styles.pinLabel}>
                {openStaffIds.has(selectedStaff.id) ? `Clock out ${selectedStaff.name}` : `Clock in ${selectedStaff.name}`}
              </Text>
              <View style={styles.dotsRow}>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
                ))}
              </View>
              <View style={styles.keypad}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                  <TouchableOpacity key={d} style={styles.key} onPress={() => handleDigit(d)} disabled={submitting}>
                    <Text style={styles.keyText}>{d}</Text>
                  </TouchableOpacity>
                ))}
                <View style={styles.key} />
                <TouchableOpacity style={styles.key} onPress={() => handleDigit('0')} disabled={submitting}>
                  <Text style={styles.keyText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.key} onPress={handleBackspace} disabled={submitting}>
                  <Ionicons name="backspace-outline" size={20} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>Recent shifts</Text>
          {recentShifts.length === 0 && <Text style={styles.emptyHint}>No shifts recorded yet.</Text>}
          {recentShifts.map(shift => (
            <View key={shift.id} style={styles.shiftRow}>
              <Text style={styles.shiftName}>{shift.staff?.name ?? 'Staff'}</Text>
              <Text style={styles.shiftTime}>
                {formatTime(shift.clock_in_at)} – {shift.clock_out_at ? formatTime(shift.clock_out_at) : 'now'}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.sm, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  staffChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  staffChipActive: { borderColor: Colors.primary },
  staffChipOpen: { backgroundColor: '#F0FDF4', borderColor: Colors.success },
  staffChipText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  staffChipTextActive: { color: Colors.primary },
  pinCard: { alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, ...Shadows.subtle },
  pinLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  dotsRow: { flexDirection: 'row', gap: Spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.primary },
  dotFilled: { backgroundColor: Colors.primary },
  keypad: { width: 220, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.sm },
  key: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundMain, borderWidth: 1, borderColor: Colors.border },
  keyText: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  shiftRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  shiftName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  shiftTime: { fontSize: 13, color: Colors.textSecondary },
});
