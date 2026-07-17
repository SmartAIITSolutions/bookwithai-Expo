import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Switch } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listStaff, createStaff, saveStaffAvailability, StaffMember, DayAvailability } from '@/lib/api/ownerStaff';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultWeek(): DayAvailability[] {
  return DAY_LABELS.map((_, i) => ({
    day_of_week: i,
    is_working: i >= 1 && i <= 5, // Mon–Fri default
    start_time: '09:00',
    end_time:   '17:00',
    break_start: null,
    break_end:   null,
  }));
}

export default function StaffScreen() {
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingWeek, setEditingWeek] = useState<DayAvailability[]>([]);

  const load = useCallback(async () => {
    const result = await listStaff();
    if (result.ok) setStaff(result.data.data.filter(s => s.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!name.trim()) {
      Alert.alert('Missing info', 'Name is required.');
      return;
    }
    setSaving(true);
    const result = await createStaff({ name: name.trim(), role: role.trim() || undefined });
    setSaving(false);
    if (result.ok) {
      setName(''); setRole(''); setAdding(false);
      load();
    } else {
      Alert.alert('Could not add staff member', result.error);
    }
  }

  function openHours(s: StaffMember) {
    if (expandedId === s.id) { setExpandedId(null); return; }
    const week = defaultWeek().map(d => {
      const existing = s.availability.find(a => a.day_of_week === d.day_of_week);
      return existing ? { ...d, ...existing, start_time: existing.start_time.slice(0, 5), end_time: existing.end_time.slice(0, 5) } : d;
    });
    setEditingWeek(week);
    setExpandedId(s.id);
  }

  async function handleSaveHours(staffId: string) {
    const result = await saveStaffAvailability(staffId, editingWeek);
    if (result.ok) { setExpandedId(null); load(); }
    else Alert.alert('Could not save hours', result.error);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Staff', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {staff.length === 0 && !adding && (
            <Text style={styles.emptyHint}>Your team starts here.</Text>
          )}
          {staff.map(s => (
            <View key={s.id} style={styles.card}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => openHours(s)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{s.name}</Text>
                  {!!s.role && <Text style={styles.staffMeta}>{s.role}</Text>}
                </View>
                <Ionicons name={expandedId === s.id ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
              </TouchableOpacity>

              {expandedId === s.id && (
                <View style={styles.hoursEditor}>
                  {editingWeek.map((day, i) => (
                    <View key={day.day_of_week} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{DAY_LABELS[day.day_of_week]}</Text>
                      <Switch
                        value={day.is_working}
                        onValueChange={(v) => setEditingWeek(w => w.map((d, idx) => idx === i ? { ...d, is_working: v } : d))}
                        trackColor={{ true: Colors.primary }}
                      />
                      {day.is_working && (
                        <>
                          <TextInput
                            style={styles.timeInput}
                            value={day.start_time}
                            onChangeText={(v) => setEditingWeek(w => w.map((d, idx) => idx === i ? { ...d, start_time: v } : d))}
                            placeholder="09:00"
                            placeholderTextColor={Colors.textDisabled}
                          />
                          <Text style={styles.toText}>to</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={day.end_time}
                            onChangeText={(v) => setEditingWeek(w => w.map((d, idx) => idx === i ? { ...d, end_time: v } : d))}
                            placeholder="17:00"
                            placeholderTextColor={Colors.textDisabled}
                          />
                        </>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity style={styles.saveHoursButton} onPress={() => handleSaveHours(s.id)}>
                    <Text style={styles.addRowText}>Save hours</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {adding ? (
            <View style={styles.addCard}>
              <TextInput style={styles.input} placeholder="Name" placeholderTextColor={Colors.textDisabled} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Role (e.g. Stylist)" placeholderTextColor={Colors.textDisabled} value={role} onChangeText={setRole} />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <ActivityIndicator color={Colors.primary} /> : <Text style={styles.addRowText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add staff member</Text>
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
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, ...Shadows.subtle, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  staffName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  staffMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  hoursEditor: { borderTopWidth: 1, borderTopColor: Colors.border, padding: Spacing.md, gap: Spacing.xs },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayLabel: { width: 36, fontSize: 13, color: Colors.textPrimary },
  timeInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: Colors.textPrimary, width: 64,
  },
  toText: { fontSize: 12, color: Colors.textSecondary },
  saveHoursButton: { alignSelf: 'flex-end', paddingTop: Spacing.xs },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});
