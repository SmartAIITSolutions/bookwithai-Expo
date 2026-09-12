import { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getBusiness, updateBusiness, addHoliday, removeHoliday, Business, Holiday } from '@/lib/api/ownerBusiness';
import { listClosures, addClosure, removeClosure, BusinessClosure } from '@/lib/api/ownerDailyOps';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { DAY_KEYS, DEFAULT_SCHEDULE, type WeekSchedule } from '@/lib/calendar/timeGrid';
import { formatWeekdayLong, formatHourOnly } from '@/lib/i18n/format';

const REFERENCE_SUNDAY = new Date(2023, 0, 1);
function weekdayLongForIndex(index: number): string {
  const d = new Date(REFERENCE_SUNDAY);
  d.setDate(REFERENCE_SUNDAY.getDate() + index);
  return formatWeekdayLong(d);
}

function formatHour(h: number): string {
  const hh = ((h % 24) + 24) % 24;
  const d = new Date(2024, 0, 1, hh, 0);
  return formatHourOnly(d);
}

// EOD Phase B blocker fix — the canonical cancellation/reschedule cutoff
// (agency_clients.booking_cutoff_minutes) previously had no owner-app
// control at all; the only mobile "cutoff"-labeled field was
// deposit_refund_cutoff_hours, a genuinely different setting (deposit
// refund eligibility, not cancel/reschedule eligibility). This mirrors the
// web dashboard's existing option set exactly (SettingsView.tsx) so the
// same value means the same thing everywhere.
const CANCELLATION_CUTOFF_OPTIONS = [60, 120, 240, 480, 720, 1440, 2880, 4320];
function formatCutoffOption(minutes: number): string {
  const hours = minutes / 60;
  return hours === 1 ? '1h' : `${hours}h`;
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Business Setup — Sprint 1, Phase 1 "Business Setup" group. Includes the
// two confirmed-missing fields from the audit: structured address and
// holiday hours (shared with SANAA via sanaa_holidays).
//
// Re-themed 2026-08-04 to match the dark/gold glass look the rest of the
// owner app (Dashboard, Calendar, More) already has -- this screen (like
// several owner-settings screens) was never brought over from the original
// light theme; only the visual layer changed here, no logic touched.
export default function BusinessSetupScreen() {
  const { t } = useTranslation(['owner']);
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
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);

  // Raw text mirrors of the deposit number fields -- kept separate from
  // `business` itself so the TextInput's displayed value is exactly what
  // was typed, never reformatted (e.g. via toFixed) mid-edit. Reformatting
  // the bound value on every keystroke was fighting the cursor position:
  // typing "5" into a field showing "0.00" with the cursor at the start
  // inserted before the 0 instead of replacing it, producing "50.00".
  const [depositPercentInput, setDepositPercentInput] = useState('');
  const [depositAmountInput, setDepositAmountInput] = useState('');
  const [cutoffHoursInput, setCutoffHoursInput] = useState('');
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  const load = useCallback(async () => {
    const [result, closureResult] = await Promise.all([getBusiness(), listClosures()]);
    if (result.ok) {
      setBusiness(result.data.business);
      setHolidays(result.data.holidays);
      setDepositPercentInput(result.data.business.deposit_percent != null ? String(result.data.business.deposit_percent) : '');
      setDepositAmountInput(result.data.business.deposit_amount_cents != null ? (result.data.business.deposit_amount_cents / 100).toFixed(2) : '');
      setCutoffHoursInput(String(result.data.business.deposit_refund_cutoff_hours ?? 24));
      setSchedule(result.data.business.week_schedule ? { ...DEFAULT_SCHEDULE, ...result.data.business.week_schedule } : DEFAULT_SCHEDULE);
    }
    if (closureResult.ok) setClosures(closureResult.data.data);
    setLoading(false);
  }, []);

  function setDay(key: string, patch: Partial<{ open: boolean; start: number; end: number }>) {
    setSchedule(s => ({ ...s, [key]: { ...s[key], ...patch } }));
  }

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
      booking_cutoff_minutes: business.booking_cutoff_minutes,
      cancellation_policy: business.cancellation_policy,
      rescheduling_policy: business.rescheduling_policy,
      store_policy: business.store_policy,
      morning_brief_hour: business.morning_brief_hour,
      max_daily_bookings: business.max_daily_bookings,
      staff_login_mode: business.staff_login_mode,
      checkin_flow_mode: business.checkin_flow_mode,
      publicly_listed: business.publicly_listed,
      require_online_payment: business.require_online_payment,
      deposit_type: business.deposit_type,
      deposit_percent: business.deposit_percent,
      deposit_amount_cents: business.deposit_amount_cents,
      deposit_refund_policy_enabled: business.deposit_refund_policy_enabled,
      deposit_refund_cutoff_hours: business.deposit_refund_cutoff_hours,
    });
    setSaving(false);
    if (!result.ok) Alert.alert(t('owner:businessScreen.couldNotSaveTitle'), result.error);
  }

  async function handleSaveSchedule() {
    setSavingSchedule(true);
    const result = await updateBusiness({ week_schedule: schedule });
    setSavingSchedule(false);
    if (!result.ok) Alert.alert(t('owner:businessScreen.couldNotSaveTitle'), result.error);
    else { setScheduleSaved(true); setTimeout(() => setScheduleSaved(false), 2500); }
  }

  async function handleAddHoliday() {
    if (!newDate.trim() || !newName.trim() || !newMessage.trim()) {
      Alert.alert(t('owner:businessScreen.missingInfoTitle'), t('owner:businessScreen.missingInfoMessage'));
      return;
    }
    const result = await addHoliday({ date: newDate.trim(), name: newName.trim(), message: newMessage.trim() });
    if (result.ok) {
      setNewDate(''); setNewName(''); setNewMessage(''); setAddingHoliday(false);
      load();
    } else {
      Alert.alert(t('owner:businessScreen.couldNotAddHolidayTitle'), result.error);
    }
  }

  async function handleRemoveHoliday(id: string) {
    const result = await removeHoliday(id);
    if (result.ok) setHolidays(h => h.filter(x => x.id !== id));
    else Alert.alert(t('owner:businessScreen.couldNotRemoveTitle'), result.error);
  }

  async function handleAddClosure() {
    if (!closureStart.trim() || !closureEnd.trim()) {
      Alert.alert(t('owner:businessScreen.missingInfoTitle'), t('owner:businessScreen.missingInfoClosureMessage'));
      return;
    }
    const result = await addClosure(closureStart.trim(), closureEnd.trim(), closureReason.trim() || undefined);
    if (result.ok) {
      setClosureStart(''); setClosureEnd(''); setClosureReason(''); setAddingClosure(false);
      load();
    } else {
      Alert.alert(t('owner:businessScreen.couldNotAddClosureTitle'), result.error);
    }
  }

  async function handleRemoveClosure(id: string) {
    const result = await removeClosure(id);
    if (result.ok) setClosures(c => c.filter(x => x.id !== id));
    else Alert.alert(t('owner:businessScreen.couldNotRemoveTitle'), result.error);
  }

  if (loading || !business) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: t('owner:businessScreen.headerTitle') }} />
        <BreathingHeart size={40} color="#F4D77A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' }, title: t('owner:businessScreen.headerTitle'), headerBackTitle: t('owner:businessScreen.headerBackTitle') }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title={t('owner:businessScreen.businessInfo')}>
          <Field label={t('owner:businessScreen.businessName')} value={business.business_name} onChangeText={v => set('business_name', v)} />
          <Field label={t('owner:businessScreen.phone')} value={business.owner_phone ?? ''} onChangeText={v => set('owner_phone', v)} keyboardType="phone-pad" />
        </Section>

        <Section title={t('owner:businessScreen.address')}>
          <Field label={t('owner:businessScreen.addressLine1')} value={business.address_line1 ?? ''} onChangeText={v => set('address_line1', v)} />
          <Field label={t('owner:businessScreen.addressLine2')} value={business.address_line2 ?? ''} onChangeText={v => set('address_line2', v)} />
          <Field label={t('owner:businessScreen.city')} value={business.city ?? ''} onChangeText={v => set('city', v)} />
          <Field label={t('owner:businessScreen.state')} value={business.state ?? ''} onChangeText={v => set('state', v)} />
          <Field label={t('owner:businessScreen.postalCode')} value={business.postal_code ?? ''} onChangeText={v => set('postal_code', v)} keyboardType="number-pad" />
        </Section>

        <Section title={t('owner:businessScreen.operatingHours')}>
          {DAY_KEYS.map((key, idx) => {
            const day = schedule[key] ?? DEFAULT_SCHEDULE[key];
            return (
              <View key={key} style={[styles.dayRow, idx > 0 && styles.dayRowBorder]}>
                <View style={styles.dayRowTop}>
                  <Text style={styles.dayLabel}>{weekdayLongForIndex(idx)}</Text>
                  <Switch
                    value={day.open}
                    onValueChange={(v) => setDay(key, { open: v })}
                    trackColor={{ true: '#F4D77A' }}
                  />
                </View>
                {day.open && (
                  <View style={styles.dayRowHours}>
                    <HourStepper label={t('owner:businessScreen.open')} hour={day.start} onChange={(h) => setDay(key, { start: h })} />
                    <HourStepper label={t('owner:businessScreen.close')} hour={day.end} onChange={(h) => setDay(key, { end: h })} />
                  </View>
                )}
              </View>
            );
          })}
          <TouchableOpacity style={styles.saveSmallButton} onPress={handleSaveSchedule} disabled={savingSchedule}>
            <Text style={styles.saveSmallButtonText}>
              {scheduleSaved ? t('owner:businessScreen.hoursSavedConfirmation') : savingSchedule ? t('owner:businessScreen.saving') : t('owner:businessScreen.saveOperatingHours')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.emptyHint}>{t('owner:businessScreen.operatingHoursHint')}</Text>
        </Section>

        <Section title={t('owner:businessScreen.policies')}>
          <Text style={styles.fieldLabel}>{t('owner:businessScreen.cancellationReschedulingWindowQuestion')}</Text>
          <Text style={styles.emptyHint}>{t('owner:businessScreen.cancellationReschedulingWindowHint')}</Text>
          <View style={[styles.hourRow, { flexWrap: 'wrap', marginBottom: Spacing.sm }]}>
            {CANCELLATION_CUTOFF_OPTIONS.map(minutes => (
              <TouchableOpacity
                key={minutes}
                style={[styles.hourChip, business.booking_cutoff_minutes === minutes && styles.hourChipActive]}
                onPress={() => set('booking_cutoff_minutes', minutes)}
              >
                <Text style={[styles.hourChipText, business.booking_cutoff_minutes === minutes && styles.hourChipTextActive]}>
                  {formatCutoffOption(minutes)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Field
            label={t('owner:businessScreen.cancellationPolicy')}
            value={business.cancellation_policy ?? ''}
            onChangeText={v => set('cancellation_policy', v)}
            multiline
          />
          <Field
            label={t('owner:businessScreen.reschedulingPolicy')}
            value={business.rescheduling_policy ?? ''}
            onChangeText={v => set('rescheduling_policy', v)}
            multiline
          />
          <Field
            label={t('owner:businessScreen.storePolicy')}
            value={business.store_policy ?? ''}
            onChangeText={v => set('store_policy', v)}
            multiline
          />
          <Field
            label={t('owner:businessScreen.maxBookingsPerDay')}
            value={business.max_daily_bookings != null ? String(business.max_daily_bookings) : ''}
            onChangeText={v => set('max_daily_bookings', v.trim() ? parseInt(v, 10) : null)}
            keyboardType="number-pad"
          />
        </Section>

        <Section title={t('owner:businessScreen.morningBrief')}>
          <Text style={styles.fieldLabel}>{t('owner:businessScreen.deliveredDailyAt')}</Text>
          <View style={styles.hourRow}>
            {[6, 7, 8, 9].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.hourChip, business.morning_brief_hour === h && styles.hourChipActive]}
                onPress={() => set('morning_brief_hour', h)}
              >
                <Text style={[styles.hourChipText, business.morning_brief_hour === h && styles.hourChipTextActive]}>
                  {formatHour(h)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        <Section title={t('owner:businessScreen.staffLogin')}>
          <Text style={styles.fieldLabel}>{t('owner:businessScreen.staffLoginQuestion')}</Text>
          <View style={styles.staffModeCol}>
            <TouchableOpacity
              style={[styles.staffModeOption, business.staff_login_mode === 'shared_device' && styles.staffModeOptionActive]}
              onPress={() => set('staff_login_mode', 'shared_device')}
            >
              <Text style={[styles.staffModeTitle, business.staff_login_mode === 'shared_device' && styles.staffModeTitleActive]}>
                {t('owner:businessScreen.sharedDevice')}
              </Text>
              <Text style={styles.staffModeDesc}>{t('owner:businessScreen.sharedDeviceDesc')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffModeOption, business.staff_login_mode === 'individual_accounts' && styles.staffModeOptionActive]}
              onPress={() => set('staff_login_mode', 'individual_accounts')}
            >
              <Text style={[styles.staffModeTitle, business.staff_login_mode === 'individual_accounts' && styles.staffModeTitleActive]}>
                {t('owner:businessScreen.individualAccounts')}
              </Text>
              <Text style={styles.staffModeDesc}>{t('owner:businessScreen.individualAccountsDesc')}</Text>
            </TouchableOpacity>
          </View>
        </Section>

        <Section title={t('owner:businessScreen.checkinCheckoutStyle')}>
          <Text style={styles.fieldLabel}>{t('owner:businessScreen.checkinCheckoutQuestion')}</Text>
          <View style={styles.staffModeCol}>
            <TouchableOpacity
              style={[styles.staffModeOption, business.checkin_flow_mode === 'full' && styles.staffModeOptionActive]}
              onPress={() => set('checkin_flow_mode', 'full')}
            >
              <Text style={[styles.staffModeTitle, business.checkin_flow_mode === 'full' && styles.staffModeTitleActive]}>
                {t('owner:businessScreen.fullFlow')}
              </Text>
              <Text style={styles.staffModeDesc}>{t('owner:businessScreen.fullFlowDesc')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.staffModeOption, business.checkin_flow_mode === 'quick' && styles.staffModeOptionActive]}
              onPress={() => set('checkin_flow_mode', 'quick')}
            >
              <Text style={[styles.staffModeTitle, business.checkin_flow_mode === 'quick' && styles.staffModeTitleActive]}>
                {t('owner:businessScreen.quickFlow')}
              </Text>
              <Text style={styles.staffModeDesc}>{t('owner:businessScreen.quickFlowDesc')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.emptyHint}>{t('owner:businessScreen.queueHint')}</Text>
        </Section>

        <Section title={t('owner:businessScreen.payments')}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={styles.fieldLabel}>{t('owner:businessScreen.requireOnlinePayment')}</Text>
              <Text style={styles.emptyHint}>{t('owner:businessScreen.requireOnlinePaymentHint')}</Text>
            </View>
            <Switch
              value={business.require_online_payment}
              onValueChange={(v) => set('require_online_payment', v)}
              trackColor={{ true: '#F4D77A' }}
            />
          </View>

          {business.require_online_payment && (
            <View style={{ marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' }}>
              <Text style={styles.fieldLabel}>{t('owner:businessScreen.depositAtBooking')}</Text>
              <Text style={styles.emptyHint}>{t('owner:businessScreen.depositAtBookingHint')}</Text>
              <View style={styles.depositTypeRow}>
                {(['none', 'percent', 'fixed'] as const).map(dt => (
                  <TouchableOpacity
                    key={dt}
                    style={[styles.depositTypeChip, business.deposit_type === dt && styles.depositTypeChipActive]}
                    onPress={() => set('deposit_type', dt)}>
                    <Text style={[styles.depositTypeChipText, business.deposit_type === dt && styles.depositTypeChipTextActive]}>
                      {dt === 'none' ? t('owner:businessScreen.depositFullPayment') : dt === 'percent' ? t('owner:businessScreen.depositPercentage') : t('owner:businessScreen.depositFixedAmount')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {business.deposit_type === 'percent' && (
                <View style={styles.inputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={t('owner:businessScreen.depositPercentPlaceholder')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={depositPercentInput}
                    onChangeText={(v) => {
                      setDepositPercentInput(v);
                      set('deposit_percent', v.trim() ? parseFloat(v) : null);
                    }}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.inputSuffix}>%</Text>
                </View>
              )}
              {business.deposit_type === 'fixed' && (
                <View style={styles.inputRow}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder={t('owner:businessScreen.depositAmountPlaceholder')}
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    value={depositAmountInput}
                    onChangeText={(v) => {
                      setDepositAmountInput(v);
                      set('deposit_amount_cents', v.trim() ? Math.round(parseFloat(v) * 100) : null);
                    }}
                    keyboardType="decimal-pad"
                  />
                </View>
              )}

              {business.deposit_type !== 'none' && (
                <View style={{ marginTop: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' }}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, paddingRight: Spacing.md }}>
                      <Text style={styles.fieldLabel}>{t('owner:businessScreen.enforceCancellationCutoff')}</Text>
                      <Text style={styles.emptyHint}>{t('owner:businessScreen.enforceCancellationCutoffHint')}</Text>
                    </View>
                    <Switch
                      value={business.deposit_refund_policy_enabled}
                      onValueChange={(v) => set('deposit_refund_policy_enabled', v)}
                      trackColor={{ true: '#F4D77A' }}
                    />
                  </View>
                  {business.deposit_refund_policy_enabled && (
                    <View style={[styles.inputRow, { marginTop: Spacing.sm }]}>
                      <TextInput
                        style={[styles.input, { flex: 1 }]}
                        placeholder={t('owner:businessScreen.hoursBeforeAppointment')}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={cutoffHoursInput}
                        onChangeText={(v) => {
                          setCutoffHoursInput(v);
                          set('deposit_refund_cutoff_hours', v.trim() ? parseInt(v, 10) || 0 : 0);
                        }}
                        keyboardType="number-pad"
                      />
                      <Text style={styles.inputSuffix}>{t('owner:businessScreen.hoursSuffix')}</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </Section>

        <Section title={t('owner:businessScreen.salonDirectory')}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: Spacing.md }}>
              <Text style={styles.fieldLabel}>{t('owner:businessScreen.showInDiscoverList')}</Text>
              <Text style={styles.emptyHint}>{t('owner:businessScreen.showInDiscoverListHint')}</Text>
            </View>
            <Switch
              value={business.publicly_listed}
              onValueChange={(v) => set('publicly_listed', v)}
              trackColor={{ true: '#F4D77A' }}
            />
          </View>
        </Section>

        <Section title={t('owner:businessScreen.holidayHours')}>
          {holidays.length === 0 && (
            <Text style={styles.emptyHint}>{t('owner:businessScreen.holidayHoursEmptyHint')}</Text>
          )}
          {holidays.map(h => (
            <View key={h.id} style={styles.holidayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.holidayName}>{h.name} — {h.date}</Text>
                <Text style={styles.holidayMessage}>{h.message}</Text>
              </View>
              <TouchableOpacity onPress={() => handleRemoveHoliday(h.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#F09595" />
              </TouchableOpacity>
            </View>
          ))}
          {addingHoliday ? (
            <View style={styles.inlineForm}>
              <TextInput
                style={styles.input}
                placeholder={t('owner:businessScreen.holidayDatePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={newDate}
                onChangeText={setNewDate}
              />
              <TextInput
                style={styles.input}
                placeholder={t('owner:businessScreen.holidayNamePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.input}
                placeholder={t('owner:businessScreen.holidayMessagePlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.35)"
                value={newMessage}
                onChangeText={setNewMessage}
              />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAddingHoliday(false)}>
                  <Text style={styles.cancelText}>{t('owner:businessScreen.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddHoliday}>
                  <Text style={styles.addRowText}>{t('owner:businessScreen.save')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAddingHoliday(true)}>
              <Ionicons name="add" size={18} color="#F4D77A" />
              <Text style={styles.addRowText}>{t('owner:businessScreen.addClosedDate')}</Text>
            </TouchableOpacity>
          )}
        </Section>

        <Section title={t('owner:businessScreen.businessClosures')}>
          <Text style={styles.emptyHint}>{t('owner:businessScreen.businessClosuresHint')}</Text>
          {closures.map(c => (
            <View key={c.id} style={styles.holidayRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.holidayName}>{c.starts_on} → {c.ends_on}</Text>
                {c.reason && <Text style={styles.holidayMessage}>{c.reason}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleRemoveClosure(c.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color="#F09595" />
              </TouchableOpacity>
            </View>
          ))}
          {addingClosure ? (
            <View style={styles.inlineForm}>
              <TextInput style={styles.input} placeholder={t('owner:businessScreen.startDatePlaceholder')} placeholderTextColor="rgba(255,255,255,0.35)" value={closureStart} onChangeText={setClosureStart} />
              <TextInput style={styles.input} placeholder={t('owner:businessScreen.endDatePlaceholder')} placeholderTextColor="rgba(255,255,255,0.35)" value={closureEnd} onChangeText={setClosureEnd} />
              <TextInput style={styles.input} placeholder={t('owner:businessScreen.reasonPlaceholder')} placeholderTextColor="rgba(255,255,255,0.35)" value={closureReason} onChangeText={setClosureReason} />
              <View style={styles.inlineFormActions}>
                <TouchableOpacity onPress={() => setAddingClosure(false)}><Text style={styles.cancelText}>{t('owner:businessScreen.cancel')}</Text></TouchableOpacity>
                <TouchableOpacity onPress={handleAddClosure}><Text style={styles.addRowText}>{t('owner:businessScreen.save')}</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addRow} onPress={() => setAddingClosure(true)}>
              <Ionicons name="add" size={18} color="#F4D77A" />
              <Text style={styles.addRowText}>{t('owner:businessScreen.addClosure')}</Text>
            </TouchableOpacity>
          )}
        </Section>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <BreathingHeart size={18} color="#09000F" /> : <Text style={styles.saveButtonText}>{t('owner:businessScreen.save')}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        {children}
      </BlurView>
    </View>
  );
}

function HourStepper({ label, hour, onChange }: { label: string; hour: number; onChange: (h: number) => void }) {
  return (
    <View style={styles.hourStepper}>
      <Text style={styles.hourStepperLabel}>{label}</Text>
      <View style={styles.hourStepperControl}>
        <TouchableOpacity onPress={() => onChange((hour + 23) % 24)} hitSlop={8}>
          <Ionicons name="remove-circle-outline" size={22} color="#F4D77A" />
        </TouchableOpacity>
        <Text style={styles.hourStepperValue}>{formatHour(hour)}</Text>
        <TouchableOpacity onPress={() => onChange((hour + 1) % 24)} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={22} color="#F4D77A" />
        </TouchableOpacity>
      </View>
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
        placeholderTextColor="rgba(255,255,255,0.35)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing['2xl'] },
  hourRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  hourChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
  },
  hourChipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  hourChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 13, color: '#FFFFFF' },
  hourChipTextActive: { color: '#09000F' },
  staffModeCol: { gap: Spacing.sm, marginTop: Spacing.xs },
  staffModeOption: {
    padding: Spacing.md, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
  },
  staffModeOptionActive: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.1)' },
  staffModeTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: 14, color: '#FFFFFF' },
  staffModeTitleActive: { color: '#F4D77A' },
  staffModeDesc: { fontFamily: FontFamily.sora, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  section: { gap: Spacing.xs },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.md,
  },
  field: { gap: 6 },
  fieldLabel: { fontFamily: FontFamily.sora, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  input: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontFamily: FontFamily.sora, fontSize: 15,
    color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.15)',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  holidayRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.xs, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  holidayName: { fontFamily: FontFamily.soraSemiBold, fontSize: 14, color: '#FFFFFF' },
  holidayMessage: { fontFamily: FontFamily.sora, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  depositTypeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  depositTypeChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  depositTypeChipActive: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.15)' },
  depositTypeChipText: { fontFamily: FontFamily.sora, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  depositTypeChipTextActive: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  inputSuffix: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)' },
  inputPrefix: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: Spacing.xs },
  addRowText: { fontFamily: FontFamily.soraSemiBold, fontSize: 14, color: '#F4D77A' },
  inlineForm: { gap: Spacing.sm, paddingTop: Spacing.xs },
  inlineFormActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, paddingTop: 2 },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  dayRow: { paddingVertical: Spacing.xs, gap: Spacing.xs },
  dayRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  dayRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: 14, color: '#FFFFFF' },
  dayRowHours: { flexDirection: 'row', gap: Spacing.lg },
  hourStepper: { gap: 2 },
  hourStepperLabel: { fontFamily: FontFamily.sora, fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  hourStepperControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hourStepperValue: { fontFamily: FontFamily.soraSemiBold, fontSize: 14, color: '#F4D77A', minWidth: 44, textAlign: 'center' },
  saveSmallButton: {
    alignSelf: 'flex-start', backgroundColor: '#F4D77A', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 9, marginTop: Spacing.xs,
  },
  saveSmallButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#09000F' },
  saveButton: {
    backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg,
    paddingVertical: 14, alignItems: 'center',
  },
  saveButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.base },
});
