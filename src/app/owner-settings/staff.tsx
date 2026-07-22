import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import {
  listStaff, createStaff, updateStaff, saveStaffAvailability, inviteStaff,
  StaffMember, DayAvailability, PermissionRole,
} from '@/lib/api/ownerStaff';
import { setStaffOverride } from '@/lib/api/ownerDailyOps';
import { getBusiness } from '@/lib/api/ownerBusiness';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERMISSION_ROLES: PermissionRole[] = ['manager', 'receptionist', 'stylist', 'assistant'];
const ROLE_LABELS: Record<PermissionRole, string> = {
  manager: 'Manager', receptionist: 'Receptionist', stylist: 'Stylist', assistant: 'Assistant',
};

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
  const [exceptionForId, setExceptionForId] = useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [staffLoginMode, setStaffLoginMode] = useState<'shared_device' | 'individual_accounts'>('shared_device');
  const [pinDraftFor, setPinDraftFor] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [inviteDraftFor, setInviteDraftFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [result, businessResult] = await Promise.all([listStaff(), getBusiness()]);
    if (result.ok) setStaff(result.data.data.filter(s => s.active));
    if (businessResult.ok) setStaffLoginMode(businessResult.data.business.staff_login_mode);
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

  async function handleSetPermissionRole(staffId: string, role: PermissionRole) {
    setSavingRoleFor(staffId);
    const result = await updateStaff(staffId, { permission_role: role });
    setSavingRoleFor(null);
    if (result.ok) load();
    else Alert.alert('Could not update role', result.error);
  }

  async function handleSaveCommissionRate(staffId: string, value: string) {
    const pct = value.trim() ? parseFloat(value) : null;
    if (value.trim() && (isNaN(pct as number) || (pct as number) < 0 || (pct as number) > 100)) {
      Alert.alert('Invalid rate', 'Enter a percentage between 0 and 100.');
      return;
    }
    const result = await updateStaff(staffId, { default_commission_rate_pct: pct });
    if (result.ok) load();
    else Alert.alert('Could not save', result.error);
  }

  async function handleSavePin(staffId: string) {
    if (pinDraft.length !== 4 || !/^\d{4}$/.test(pinDraft)) {
      Alert.alert('Invalid PIN', 'Enter a 4-digit PIN.');
      return;
    }
    const result = await updateStaff(staffId, { pin: pinDraft });
    if (result.ok) {
      setPinDraftFor(null); setPinDraft('');
      load();
    } else {
      Alert.alert('Could not save PIN', result.error);
    }
  }

  async function handleSendInvite(staffId: string) {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    const result = await inviteStaff(staffId, inviteEmail.trim());
    if (result.ok) {
      Alert.alert('Invite sent', `An invite was sent to ${inviteEmail.trim()}.`);
      setInviteDraftFor(null); setInviteEmail('');
      load();
    } else {
      Alert.alert('Could not send invite', result.error);
    }
  }

  function handleRemoveStaff(s: StaffMember) {
    Alert.alert(
      `Remove ${s.name}?`,
      "They'll no longer appear in scheduling or booking. This doesn't delete their past appointment or commission history.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await updateStaff(s.id, { active: false });
            if (result.ok) {
              setExpandedId(null);
              load();
            } else {
              Alert.alert('Could not remove staff member', result.error);
            }
          },
        },
      ]
    );
  }

  async function handleSaveException(staffId: string) {
    if (!exceptionDate.trim()) { Alert.alert('Missing date', 'Enter a date (YYYY-MM-DD).'); return; }
    const result = await setStaffOverride(staffId, { date: exceptionDate.trim(), is_working: false, reason: exceptionReason.trim() || undefined });
    if (result.ok) {
      Alert.alert('Saved', `${exceptionDate} marked as a day off.`);
      setExceptionForId(null); setExceptionDate(''); setExceptionReason('');
    } else {
      Alert.alert('Could not save', result.error);
    }
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ title: 'Staff', headerBackTitle: 'More' }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color={Colors.primary} /></View>
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

                  <View style={styles.roleSection}>
                    <Text style={styles.exceptionLabel}>Role & permissions</Text>
                    <View style={styles.roleChipRow}>
                      {PERMISSION_ROLES.map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleChip, s.permission_role === r && styles.roleChipActive]}
                          disabled={savingRoleFor === s.id}
                          onPress={() => handleSetPermissionRole(s.id, r)}
                        >
                          <Text style={[styles.roleChipText, s.permission_role === r && styles.roleChipTextActive]}>
                            {ROLE_LABELS[r]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.exceptionLabel, { marginTop: Spacing.sm }]}>Default commission rate (%)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 40"
                      placeholderTextColor={Colors.textDisabled}
                      defaultValue={s.default_commission_rate_pct != null ? String(s.default_commission_rate_pct) : ''}
                      onEndEditing={(e) => handleSaveCommissionRate(s.id, e.nativeEvent.text)}
                      keyboardType="decimal-pad"
                    />

                    {staffLoginMode === 'shared_device' ? (
                      pinDraftFor === s.id ? (
                        <View style={styles.inlineFormActions}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="4-digit PIN"
                            placeholderTextColor={Colors.textDisabled}
                            value={pinDraft}
                            onChangeText={(t) => setPinDraft(t.replace(/\D/g, '').slice(0, 4))}
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={4}
                          />
                          <TouchableOpacity onPress={() => { setPinDraftFor(null); setPinDraft(''); }}>
                            <Text style={styles.cancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleSavePin(s.id)}>
                            <Text style={styles.addRowText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addRow} onPress={() => setPinDraftFor(s.id)}>
                          <Ionicons name="keypad-outline" size={16} color={Colors.primary} />
                          <Text style={styles.addRowText}>{s.has_pin ? 'Change PIN' : 'Set a clock-in PIN'}</Text>
                        </TouchableOpacity>
                      )
                    ) : s.auth_user_id ? (
                      <Text style={styles.exceptionLabel}>Account active</Text>
                    ) : inviteDraftFor === s.id ? (
                      <View style={styles.inlineFormActions}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder="Email address"
                          placeholderTextColor={Colors.textDisabled}
                          value={inviteEmail}
                          onChangeText={setInviteEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                        <TouchableOpacity onPress={() => { setInviteDraftFor(null); setInviteEmail(''); }}>
                          <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleSendInvite(s.id)}>
                          <Text style={styles.addRowText}>Invite</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addRow} onPress={() => setInviteDraftFor(s.id)}>
                        <Ionicons name="mail-outline" size={16} color={Colors.primary} />
                        <Text style={styles.addRowText}>
                          {s.invite_status === 'invited' ? `Invite pending (${s.invite_email})` : 'Invite to create an account'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {exceptionForId === s.id ? (
                    <View style={styles.exceptionForm}>
                      <Text style={styles.exceptionLabel}>Mark a specific date off (sick day, etc.)</Text>
                      <TextInput style={styles.input} placeholder="Date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={exceptionDate} onChangeText={setExceptionDate} />
                      <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor={Colors.textDisabled} value={exceptionReason} onChangeText={setExceptionReason} />
                      <View style={styles.inlineFormActions}>
                        <TouchableOpacity onPress={() => setExceptionForId(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleSaveException(s.id)}><Text style={styles.addRowText}>Save</Text></TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addRow} onPress={() => setExceptionForId(s.id)}>
                      <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
                      <Text style={styles.addRowText}>Add a day-off exception</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.removeRow} onPress={() => handleRemoveStaff(s)}>
                    <Ionicons name="person-remove-outline" size={16} color={Colors.error} />
                    <Text style={styles.removeRowText}>Remove staff member</Text>
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
                  {saving ? <BreathingHeart size={18} color={Colors.primary} /> : <Text style={styles.addRowText}>Save</Text>}
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
  container: { flex: 1, backgroundColor: '#040108' },
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
  exceptionForm: { gap: Spacing.xs, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  roleSection: { gap: Spacing.xs, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundMain, borderWidth: 1, borderColor: Colors.border,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleChipText: { fontSize: 12.5, color: Colors.textPrimary, fontWeight: '600' },
  roleChipTextActive: { color: Colors.textOnPrimary },
  exceptionLabel: { fontSize: 12.5, color: Colors.textSecondary },
  addCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadows.subtle },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  removeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.sm,
    marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  removeRowText: { fontSize: 14, color: Colors.error, fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
});
