import { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { Stack } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  listStaff, createStaff, updateStaff, saveStaffAvailability, inviteStaff,
  StaffMember, DayAvailability, PermissionRole,
} from '@/lib/api/ownerStaff';
import { setStaffOverride } from '@/lib/api/ownerDailyOps';
import { getBusiness } from '@/lib/api/ownerBusiness';
import { formatWeekdayShort } from '@/lib/i18n/format';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERMISSION_ROLES: PermissionRole[] = ['manager', 'receptionist', 'stylist', 'assistant'];
const REFERENCE_SUNDAY = new Date(2023, 0, 1);
function weekdayShortForIndex(index: number): string {
  const d = new Date(REFERENCE_SUNDAY);
  d.setDate(REFERENCE_SUNDAY.getDate() + index);
  return formatWeekdayShort(d);
}

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
  const { t } = useTranslation(['owner']);
  const ROLE_LABELS: Record<PermissionRole, string> = {
    manager: t('owner:staffScreen.roleManager'),
    receptionist: t('owner:staffScreen.roleReceptionist'),
    stylist: t('owner:staffScreen.roleStylist'),
    assistant: t('owner:staffScreen.roleAssistant'),
  };
  // Perf pass — reuses the same ['owner-staff']/['owner-business'] query
  // keys calendar.tsx/dashboard.tsx already fetch under, so this settings
  // screen (pushed onto the stack, fully unmounts/remounts on every
  // visit) reads whatever's already cached instantly on a revisit instead
  // of blanking to a spinner and re-fetching every time.
  const staffQuery = useQuery({ queryKey: ['owner-staff'], queryFn: async () => {
    const r = await listStaff();
    if (!r.ok) throw new Error(r.error);
    return r.data.data;
  } });
  const businessQuery = useQuery({ queryKey: ['owner-business'], queryFn: async () => {
    const r = await getBusiness();
    if (!r.ok) throw new Error(r.error);
    return r.data.business;
  } });
  const loading = staffQuery.isLoading || businessQuery.isLoading;
  const staff = (staffQuery.data ?? []).filter(s => s.active);
  const staffLoginMode = businessQuery.data?.staff_login_mode ?? 'shared_device';
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingWeek, setEditingWeek] = useState<DayAvailability[]>([]);
  const [exceptionForId, setExceptionForId] = useState<string | null>(null);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [pinDraftFor, setPinDraftFor] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState('');
  const [inviteDraftFor, setInviteDraftFor] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [savingRoleFor, setSavingRoleFor] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) {
      Alert.alert(t('owner:staffScreen.missingInfoTitle'), t('owner:staffScreen.missingInfoMessage'));
      return;
    }
    setSaving(true);
    const result = await createStaff({ name: name.trim(), role: role.trim() || undefined });
    setSaving(false);
    if (result.ok) {
      setName(''); setRole(''); setAdding(false);
      staffQuery.refetch();
    } else {
      Alert.alert(t('owner:staffScreen.couldNotAddStaffTitle'), result.error);
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
    if (result.ok) { setExpandedId(null); staffQuery.refetch(); }
    else Alert.alert(t('owner:staffScreen.couldNotSaveHoursTitle'), result.error);
  }

  async function handleSetPermissionRole(staffId: string, role: PermissionRole) {
    setSavingRoleFor(staffId);
    const result = await updateStaff(staffId, { permission_role: role });
    setSavingRoleFor(null);
    if (result.ok) staffQuery.refetch();
    else Alert.alert(t('owner:staffScreen.couldNotUpdateRoleTitle'), result.error);
  }

  async function handleSaveCommissionRate(staffId: string, value: string) {
    const pct = value.trim() ? parseFloat(value) : null;
    if (value.trim() && (isNaN(pct as number) || (pct as number) < 0 || (pct as number) > 100)) {
      Alert.alert(t('owner:staffScreen.invalidRateTitle'), t('owner:staffScreen.invalidRateMessage'));
      return;
    }
    const result = await updateStaff(staffId, { default_commission_rate_pct: pct });
    if (result.ok) staffQuery.refetch();
    else Alert.alert(t('owner:staffScreen.couldNotSaveTitle'), result.error);
  }

  async function handleSavePin(staffId: string) {
    if (pinDraft.length !== 4 || !/^\d{4}$/.test(pinDraft)) {
      Alert.alert(t('owner:staffScreen.invalidPinTitle'), t('owner:staffScreen.invalidPinMessage'));
      return;
    }
    const result = await updateStaff(staffId, { pin: pinDraft });
    if (result.ok) {
      setPinDraftFor(null); setPinDraft('');
      staffQuery.refetch();
    } else {
      Alert.alert(t('owner:staffScreen.couldNotSavePinTitle'), result.error);
    }
  }

  async function handleSendInvite(staffId: string) {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      Alert.alert(t('owner:staffScreen.invalidEmailTitle'), t('owner:staffScreen.invalidEmailMessage'));
      return;
    }
    const result = await inviteStaff(staffId, inviteEmail.trim());
    if (result.ok) {
      Alert.alert(t('owner:staffScreen.inviteSentTitle'), t('owner:staffScreen.inviteSentMessage', { email: inviteEmail.trim() }));
      setInviteDraftFor(null); setInviteEmail('');
      staffQuery.refetch();
    } else {
      Alert.alert(t('owner:staffScreen.couldNotSendInviteTitle'), result.error);
    }
  }

  function handleRemoveStaff(s: StaffMember) {
    Alert.alert(
      t('owner:staffScreen.removeStaffTitle', { name: s.name }),
      t('owner:staffScreen.removeStaffMessage'),
      [
        { text: t('owner:staffScreen.cancel'), style: 'cancel' },
        {
          text: t('owner:staffScreen.remove'),
          style: 'destructive',
          onPress: async () => {
            const result = await updateStaff(s.id, { active: false });
            if (result.ok) {
              setExpandedId(null);
              staffQuery.refetch();
            } else {
              Alert.alert(t('owner:staffScreen.couldNotRemoveStaffTitle'), result.error);
            }
          },
        },
      ]
    );
  }

  async function handleSaveException(staffId: string) {
    if (!exceptionDate.trim()) { Alert.alert(t('owner:staffScreen.missingDateTitle'), t('owner:staffScreen.missingDateMessage')); return; }
    const result = await setStaffOverride(staffId, { date: exceptionDate.trim(), is_working: false, reason: exceptionReason.trim() || undefined });
    if (result.ok) {
      Alert.alert(t('owner:staffScreen.savedTitle'), t('owner:staffScreen.markedAsDayOffMessage', { date: exceptionDate }));
      setExceptionForId(null); setExceptionDate(''); setExceptionReason('');
    } else {
      Alert.alert(t('owner:staffScreen.couldNotSaveTitle'), result.error);
    }
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: t('owner:staffScreen.headerTitle'), headerBackTitle: t('owner:staffScreen.headerBackTitle') }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color={'#F4D77A'} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {staff.length === 0 && !adding && (
            <Text style={styles.emptyHint}>{t('owner:staffScreen.emptyHint')}</Text>
          )}
          {staff.map(s => (
            <BlurView key={s.id} intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <TouchableOpacity style={styles.cardHeader} onPress={() => openHours(s)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.staffName}>{s.name}</Text>
                  {!!s.role && <Text style={styles.staffMeta}>{s.role}</Text>}
                </View>
                <Ionicons name={expandedId === s.id ? 'chevron-up' : 'chevron-down'} size={18} color={'rgba(255,255,255,0.6)'} />
              </TouchableOpacity>

              {expandedId === s.id && (
                <View style={styles.hoursEditor}>
                  {editingWeek.map((day, i) => (
                    <View key={day.day_of_week} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{weekdayShortForIndex(day.day_of_week)}</Text>
                      <Switch
                        value={day.is_working}
                        onValueChange={(v) => setEditingWeek(w => w.map((d, idx) => idx === i ? { ...d, is_working: v } : d))}
                        trackColor={{ true: '#F4D77A' }}
                      />
                      {day.is_working && (
                        <>
                          <TextInput
                            style={styles.timeInput}
                            value={day.start_time}
                            onChangeText={(v) => setEditingWeek(w => w.map((d, idx) => idx === i ? { ...d, start_time: v } : d))}
                            placeholder="09:00"
                            placeholderTextColor={'rgba(255,255,255,0.35)'}
                          />
                          <Text style={styles.toText}>{t('owner:staffScreen.to')}</Text>
                          <TextInput
                            style={styles.timeInput}
                            value={day.end_time}
                            onChangeText={(v) => setEditingWeek(w => w.map((d, idx) => idx === i ? { ...d, end_time: v } : d))}
                            placeholder="17:00"
                            placeholderTextColor={'rgba(255,255,255,0.35)'}
                          />
                        </>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity style={styles.saveHoursButton} onPress={() => handleSaveHours(s.id)}>
                    <Text style={styles.addRowText}>{t('owner:staffScreen.saveHours')}</Text>
                  </TouchableOpacity>

                  <View style={styles.roleSection}>
                    <Text style={styles.exceptionLabel}>{t('owner:staffScreen.rolePermissions')}</Text>
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

                    <Text style={[styles.exceptionLabel, { marginTop: Spacing.sm }]}>{t('owner:staffScreen.defaultCommissionRate')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('owner:staffScreen.commissionRatePlaceholder')}
                      placeholderTextColor={'rgba(255,255,255,0.35)'}
                      defaultValue={s.default_commission_rate_pct != null ? String(s.default_commission_rate_pct) : ''}
                      onEndEditing={(e) => handleSaveCommissionRate(s.id, e.nativeEvent.text)}
                      keyboardType="decimal-pad"
                    />

                    {staffLoginMode === 'shared_device' ? (
                      pinDraftFor === s.id ? (
                        <View style={styles.inlineFormActions}>
                          <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder={t('owner:staffScreen.pinPlaceholder')}
                            placeholderTextColor={'rgba(255,255,255,0.35)'}
                            value={pinDraft}
                            onChangeText={(v) => setPinDraft(v.replace(/\D/g, '').slice(0, 4))}
                            keyboardType="number-pad"
                            secureTextEntry
                            maxLength={4}
                          />
                          <TouchableOpacity onPress={() => { setPinDraftFor(null); setPinDraft(''); }}>
                            <Text style={styles.cancelText}>{t('owner:staffScreen.cancel')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleSavePin(s.id)}>
                            <Text style={styles.addRowText}>{t('owner:staffScreen.save')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.addRow} onPress={() => setPinDraftFor(s.id)}>
                          <Ionicons name="keypad-outline" size={16} color={'#F4D77A'} />
                          <Text style={styles.addRowText}>{s.has_pin ? t('owner:staffScreen.changePin') : t('owner:staffScreen.setClockInPin')}</Text>
                        </TouchableOpacity>
                      )
                    ) : s.auth_user_id ? (
                      <Text style={styles.exceptionLabel}>{t('owner:staffScreen.accountActive')}</Text>
                    ) : inviteDraftFor === s.id ? (
                      <View style={styles.inlineFormActions}>
                        <TextInput
                          style={[styles.input, { flex: 1 }]}
                          placeholder={t('owner:staffScreen.emailPlaceholder')}
                          placeholderTextColor={'rgba(255,255,255,0.35)'}
                          value={inviteEmail}
                          onChangeText={setInviteEmail}
                          autoCapitalize="none"
                          keyboardType="email-address"
                        />
                        <TouchableOpacity onPress={() => { setInviteDraftFor(null); setInviteEmail(''); }}>
                          <Text style={styles.cancelText}>{t('owner:staffScreen.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleSendInvite(s.id)}>
                          <Text style={styles.addRowText}>{t('owner:staffScreen.invite')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.addRow} onPress={() => setInviteDraftFor(s.id)}>
                        <Ionicons name="mail-outline" size={16} color={'#F4D77A'} />
                        <Text style={styles.addRowText}>
                          {s.invite_status === 'invited' ? t('owner:staffScreen.invitePending', { email: s.invite_email }) : t('owner:staffScreen.inviteToCreateAccount')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {exceptionForId === s.id ? (
                    <View style={styles.exceptionForm}>
                      <Text style={styles.exceptionLabel}>{t('owner:staffScreen.markDateOff')}</Text>
                      <TextInput style={styles.input} placeholder={t('owner:staffScreen.datePlaceholder')} placeholderTextColor={'rgba(255,255,255,0.35)'} value={exceptionDate} onChangeText={setExceptionDate} />
                      <TextInput style={styles.input} placeholder={t('owner:staffScreen.reasonPlaceholder')} placeholderTextColor={'rgba(255,255,255,0.35)'} value={exceptionReason} onChangeText={setExceptionReason} />
                      <View style={styles.inlineFormActions}>
                        <TouchableOpacity onPress={() => setExceptionForId(null)}><Text style={styles.cancelText}>{t('owner:staffScreen.cancel')}</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleSaveException(s.id)}><Text style={styles.addRowText}>{t('owner:staffScreen.save')}</Text></TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.addRow} onPress={() => setExceptionForId(s.id)}>
                      <Ionicons name="calendar-outline" size={16} color={'#F4D77A'} />
                      <Text style={styles.addRowText}>{t('owner:staffScreen.addDayOffException')}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.removeRow} onPress={() => handleRemoveStaff(s)}>
                    <Ionicons name="person-remove-outline" size={16} color={'#F09595'} />
                    <Text style={styles.removeRowText}>{t('owner:staffScreen.removeStaffMember')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </BlurView>
          ))}

          {adding ? (
            <BlurView intensity={90} tint="dark" style={styles.addCard}>
              <CardOverlay />
              <TextInput style={styles.input} placeholder={t('owner:staffScreen.namePlaceholder')} placeholderTextColor={'rgba(255,255,255,0.35)'} value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder={t('owner:staffScreen.rolePlaceholder')} placeholderTextColor={'rgba(255,255,255,0.35)'} value={role} onChangeText={setRole} />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAdding(false)}>
                  <Text style={styles.cancelText}>{t('owner:staffScreen.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAdd} disabled={saving}>
                  {saving ? <BreathingHeart size={18} color={'#F4D77A'} /> : <Text style={styles.addRowText}>{t('owner:staffScreen.save')}</Text>}
                </TouchableOpacity>
              </View>
            </BlurView>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAdding(true)}>
              <Ionicons name="add" size={18} color={'#F4D77A'} />
              <Text style={styles.addRowText}>{t('owner:staffScreen.addStaffMember')}</Text>
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
  emptyHint: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: Spacing.sm },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  staffName: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.base, color: '#FFFFFF' },
  staffMeta: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  hoursEditor: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', padding: Spacing.md, gap: Spacing.xs },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dayLabel: { width: 36, fontSize: 13, color: '#FFFFFF' },
  timeInput: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', borderRadius: BorderRadius.sm,
    paddingHorizontal: 8, paddingVertical: 6, fontSize: 13, color: '#FFFFFF', width: 64,
  },
  toText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  saveHoursButton: { alignSelf: 'flex-end', paddingTop: Spacing.xs },
  exceptionForm: { gap: Spacing.xs, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', paddingTop: Spacing.sm },
  roleSection: { gap: Spacing.xs, marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', paddingTop: Spacing.sm },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  roleChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
  },
  roleChipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  roleChipText: { fontSize: 12.5, color: '#FFFFFF', fontWeight: '600' },
  roleChipTextActive: { color: '#09000F' },
  exceptionLabel: { fontSize: 12.5, color: 'rgba(255,255,255,0.6)' },
  addCard: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.sm,
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: '#FFFFFF',
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: '#F4D77A', fontWeight: '600' },
  removeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.sm,
    marginTop: Spacing.xs, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)',
  },
  removeRowText: { fontSize: 14, color: '#F09595', fontWeight: '600' },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
});
