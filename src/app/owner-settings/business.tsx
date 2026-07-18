import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getBusiness, updateBusiness, addHoliday, removeHoliday, Business, Holiday } from '@/lib/api/ownerBusiness';
import { listClosures, addClosure, removeClosure, BusinessClosure } from '@/lib/api/ownerDailyOps';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

// Business Setup — Sprint 1, Phase 1 "Business Setup" group. Includes the
// two confirmed-missing fields from the audit: structured address and
// holiday hours (shared with SANAA via sanaa_holidays).
export default function BusinessSetupScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<Business | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [closures, setClosures] = useState<BusinessClosure[]>([]);
  const [addingClosure, setAddingClosure] = useState(false);
  const [closureStart, setClosureStart] = useState('');
  const [closureEnd, setClosureEnd] = useState('');
  const [closureReason, setClosureReason] = useState('');

  const load = useCallback(async () => {
    const [result, closureResult] = await Promise.all([getBusiness(), listClosures()]);
    if (result.ok) {
      setBusiness(result.data.business);
      setHolidays(result.data.holidays);
    }
    if (closureResult.ok) setClosures(closureResult.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function set<K extends keyof Business>(key: K, value: Business[K]) {
    setBusiness(b => (b ? { ...b, [key]: value } : b));
  }

  async function handleSave() {
    if (!business) return;
    setSaving(true);
    const result = await updateBusiness({
      business_name: business.business_name,
      owner_phone: business.owner_phone,
      address_line1: business.address_line1,
      address_line2: business.address_line2,
      city: business.city,
      state: business.state,
      postal_code: business.postal_code,
      cancellation_policy: business.cancellation_policy,
      morning_brief_hour: business.morning_brief_hour,
      max_daily_bookings: business.max_daily_bookings,
      staff_login_mode: business.staff_login_mode,
    });
    setSaving(false);
    if (!result.ok) Alert.alert('Could not save', result.error);
  }

  async function handleAddHoliday() {
    if (!newDate.trim() || !newName.trim() || !newMessage.trim()) {
      Alert.alert('Missing info', 'Date, name, and message are all required.');
      return;
    }
    const result = await addHoliday({ date: newDate.trim(), name: newName.trim(), message: newMessage.trim() });
    if (result.ok) {
      setNewDate(''); setNewName(''); setNewMessage(''); setAddingHoliday(false);
      load();
    } else {
      Alert.alert('Could not add holiday', result.error);
    }
  }

  async function handleRemoveHoliday(id: string) {
    const result = await removeHoliday(id);
    if (result.ok) setHolidays(h => h.filter(x => x.id !== id));
    else Alert.alert('Could not remove', result.error);
  }

  async function handleAddClosure() {
    if (!closureStart.trim() || !closureEnd.trim()) {
      Alert.alert('Missing info', 'Start and end dates are required (YYYY-MM-DD).');
      return;
    }
    const result = await addClosure(closureStart.trim(), closureEnd.trim(), closureReason.trim() || undefined);
    if (result.ok) {
      setClosureStart(''); setClosureEnd(''); setClosureReason(''); setAddingClosure(false);
      load();
    } else {
      Alert.alert('Could not add closure', result.error);
    }
  }

  async function handleRemoveClosure(id: string) {
    const result = await removeClosure(id);
    if (result.ok) setClosures(c => c.filter(x => x.id !== id));
  }

  if (loading || !business) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ title: 'Business Setup' }} />
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Business Setup', headerBackTitle: 'More' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Business Info">
          <Field label="Business name" value={business.business_name} onChangeText={v => set('business_name', v)} />
          <Field label="Phone" value={business.owner_phone ?? ''} onChangeText={v => set('owner_phone', v)} keyboardType="phone-pad" />
        </Section>

        <Section title="Address">
          <Field label="Address line 1" value={business.address_line1 ?? ''} onChangeText={v => set('address_line1', v)} />
          <Field label="Address line 2" value={business.address_line2 ?? ''} onChangeText={v => set('address_line2', v)} />
          <Field label="City" value={business.city ?? ''} onChangeText={v => set('city', v)} />
          <Field label="State" value={business.state ?? ''} onChangeText={v => set('state', v)} />
          <Field label="Postal code" value={business.postal_code ?? ''} onChangeText={v => set('postal_code', v)} keyboardType="number-pad" />
        </Section>

        <Section title="Policies">
          <Field
            label="Cancellation policy"
            value={business.cancellation_policy ?? ''}
            onChangeText={v => set('cancellation_policy', v)}
            multiline
          />
          <Field
            label="Max bookings per day (blank = no cap)"
            value={business.max_daily_bookings != null ? String(business.max_daily_bookings) : ''}
            onChangeText={v => set('max_daily_bookings', v.trim() ? parseInt(v, 10) : null)}
            keyboardType="number-pad"
          />
        </Section>

        <Section title="Morning Brief">
          <Text style={styles.fieldLabel}>Delivered daily at:</Text>
          <View style={styles.hourRow}>
            {[6, 7, 8, 9].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.hourChip, business.morning_brief_hour === h && styles.hourChipActive]}
                onPress={() => set('morning_brief_hour', h)}
              >
                <Text style={[styles.hourChipText, business.morning_brief_hour === h && styles.hourChipTextActive]}>
                  {h > 12 ? h - 12 : h}{h >= 12 ? 'PM' : 'AM'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title="Staff Login">
          <Text style={styles.fieldLabel}>How does your team clock in and access their schedule?</Text>
          <View style={styles.staffModeCol}>
            <TouchableOpacity
              style={[styles.staffModeOption, business.staff_login_mode === 'shared_device' && styles.staffModeOptionActive]}
              onPress={() => set('staff_login_mode', 'shared_device')}
            >
              <Text style={[styles.staffModeTitle, business.staff_login_mode === 'shared_device' && styles.staffModeTitleActive]}>
                Shared device
              </Text>
              <Text style={styles.staffModeDesc}>Staff tap their name + a PIN on one front-desk device to clock in.</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffModeOption, business.staff_login_mode === 'individual_accounts' && styles.staffModeOptionActive]}
              onPress={() => set('staff_login_mode', 'individual_accounts')}
            >
              <Text style={[styles.staffModeTitle, business.staff_login_mode === 'individual_accounts' && styles.staffModeTitleActive]}>
                Individual accounts
              </Text>
              <Text style={styles.staffModeDesc}>Each staff member signs in on their own device with their own account.</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title="Holiday Hours">
          {holidays.length === 0 && (
            <Text style={styles.emptyHint}>Add dates you're closed — SANAA reads these automatically to callers too.</Text>
          )}
          {holidays.map(h => (
            <View key={h.id} style={styles.holidayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.holidayName}>{h.name} — {h.date}</Text>
                <Text style={styles.holidayMessage}>{h.message}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveHoliday(h.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {addingHoliday ? (
            <View style={styles.inlineForm}>
              <TextInput
                style={styles.input}
                placeholder="Date (YYYY-MM-DD)"
                placeholderTextColor={Colors.textDisabled}
                value={newDate}
                onChangeText={setNewDate}
              />
              <TextInput
                style={styles.input}
                placeholder="Name (e.g. Christmas Day)"
                placeholderTextColor={Colors.textDisabled}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.input}
                placeholder="Message (what SANAA/customers hear)"
                placeholderTextColor={Colors.textDisabled}
                value={newMessage}
                onChangeText={setNewMessage}
              />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAddingHoliday(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddHoliday}>
                  <Text style={styles.addRowText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAddingHoliday(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add closed date</Text>
            </TouchableOpacity>
          )}
        </Section>

        <Section title="Business Closures">
          <Text style={styles.emptyHint}>Multi-day closures (vacation, renovation) — distinct from single-day holiday hours above.</Text>
          {closures.map(c => (
            <View key={c.id} style={styles.holidayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.holidayName}>{c.starts_on} → {c.ends_on}</Text>
                {c.reason && <Text style={styles.holidayMessage}>{c.reason}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleRemoveClosure(c.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.error} />
              </TouchableOpacity>
            </View>
          ))}
          {addingClosure ? (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={closureStart} onChangeText={setClosureStart} />
              <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD)" placeholderTextColor={Colors.textDisabled} value={closureEnd} onChangeText={setClosureEnd} />
              <TextInput style={styles.input} placeholder="Reason (optional)" placeholderTextColor={Colors.textDisabled} value={closureReason} onChangeText={setClosureReason} />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAddingClosure(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAddClosure}><Text style={styles.addRowText}>Save</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAddingClosure(true)}>
              <Ionicons name="add" size={18} color={Colors.primary} />
              <Text style={styles.addRowText}>Add closure</Text>
            </TouchableOpacity>
          )}
        </Section>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.saveButtonText}>Save</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Field(props: {
  label: string; value: string; onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad'; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && styles.inputMultiline]}
        value={props.value}
        onChangeText={props.onChangeText}
        keyboardType={props.keyboardType ?? 'default'}
        multiline={props.multiline}
        placeholderTextColor={Colors.textDisabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.backgroundMain },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  hourRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  hourChip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.backgroundMain, borderWidth: 1, borderColor: Colors.border },
  hourChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  hourChipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  hourChipTextActive: { color: Colors.textOnPrimary },
  staffModeCol: { gap: Spacing.sm, marginTop: Spacing.xs },
  staffModeOption: {
    padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundMain, borderWidth: 1, borderColor: Colors.border,
  },
  staffModeOptionActive: { borderColor: Colors.primary, backgroundColor: Colors.card },
  staffModeTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  staffModeTitleActive: { color: Colors.primary },
  staffModeDesc: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  section: { gap: Spacing.xs },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase',
    color: Colors.textSecondary, marginLeft: Spacing.xs,
  },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadows.subtle },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, color: Colors.textSecondary },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  holidayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  holidayName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  holidayMessage: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  emptyHint: { fontSize: 13, color: Colors.textSecondary },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  inlineForm: { gap: Spacing.sm, paddingTop: Spacing.xs },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  saveButton: {
    backgroundColor: Colors.buttonPrimaryBg, borderRadius: BorderRadius.lg,
    paddingVertical: 14, alignItems: 'center', ...Shadows.button,
  },
  saveButtonText: { color: Colors.buttonPrimaryText, fontSize: 15, fontWeight: '700' },
});
