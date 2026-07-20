import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { CheckoutSheet, CheckoutSheetHandle } from '@/components/owner/CheckoutSheet';
import { WalkInSheet } from '@/components/owner/WalkInSheet';
import { TimelineCalendar } from '@/components/owner/TimelineCalendar';
import { AgendaView } from '@/components/owner/AgendaView';
import { MonthView } from '@/components/owner/MonthView';
import { MultiDayView } from '@/components/owner/MultiDayView';
import { TimelineStripView } from '@/components/owner/TimelineStripView';
import { useOwnerBookings } from '@/lib/calendar/useOwnerBookings';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { getBusiness, Business } from '@/lib/api/ownerBusiness';
import { OwnerBooking, bulkCancelBookings, bulkShiftBookings } from '@/lib/api/ownerBookings';
import { dayScheduleFor } from '@/lib/calendar/timeGrid';
import { findEmptySpaces, computeCalendarAlerts } from '@/lib/calendar/calendarInsights';
import { ErrorState } from '@/components/ErrorState';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatMinutesAsTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

type CalendarMode = 'day' | '3day' | 'week' | 'month' | 'agenda' | 'timeline';
const MODES: { key: CalendarMode; label: string }[] = [
  { key: 'day', label: 'Day' }, { key: '3day', label: '3-Day' }, { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' }, { key: 'agenda', label: 'Agenda' }, { key: 'timeline', label: 'Timeline' },
];

// Day view (Phase 0.3 default) — full hour-grid timeline with drag-to-move,
// pinch-to-zoom, and swipe gestures. Five more modes for viewing/navigating
// (Sprint 6): 3-Day, Week, Month, Agenda, Timeline.
export default function OwnerCalendarScreen() {
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('day');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const sheetRef = useRef<BottomSheetModal>(null);
  const walkInRef = useRef<BottomSheetModal>(null);
  const checkoutRef = useRef<CheckoutSheetHandle>(null);

  const dateKey = toDateKey(date);
  const { bookings, loading, reload } = useOwnerBookings(dateKey);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // Keep the open Appointment Sheet's booking in sync with fresh data --
  // without this, actions like Check-In/No-Show correctly update the
  // backend and refetch `bookings`, but the sheet keeps rendering the
  // stale object it was opened with, looking like the action did nothing.
  useEffect(() => {
    if (!selectedBooking) return;
    const fresh = bookings.find(b => b.id === selectedBooking.id);
    if (fresh && fresh !== selectedBooking) setSelectedBooking(fresh);
  }, [bookings, selectedBooking]);

  const loadBusiness = useCallback(() => {
    setBusinessError(null);
    getBusiness().then(result => {
      if (result.ok) setBusiness(result.data.business);
      else setBusinessError(result.error);
    });
  }, []);

  useEffect(() => {
    listStaff().then(result => { if (result.ok) setStaff(result.data.data.filter(s => s.active)); });
    loadBusiness();
  }, [loadBusiness]);

  function shiftDay(delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    setDate(next);
  }

  function openBooking(b: OwnerBooking) {
    if (selectMode) {
      setSelectedIds(ids => ids.includes(b.id) ? ids.filter(x => x !== b.id) : [...ids, b.id]);
      return;
    }
    setSelectedBooking(b);
    sheetRef.current?.present();
  }

  function handleSelectDateFromMonth(d: Date) {
    setDate(d);
    setMode('day');
  }

  const handleChanged = useCallback(() => {
    sheetRef.current?.dismiss();
    reload();
  }, [reload]);

  const handleReadyForCheckout = useCallback(() => {
    sheetRef.current?.dismiss();
    checkoutRef.current?.present();
  }, []);

  const handleCheckoutDone = useCallback(() => {
    checkoutRef.current?.dismiss();
    sheetRef.current?.dismiss();
    reload();
  }, [reload]);

  const handleWalkInBooked = useCallback(() => {
    walkInRef.current?.dismiss();
    reload();
  }, [reload]);

  async function handleBulkCancel() {
    Alert.alert('Cancel selected appointments?', `${selectedIds.length} appointment(s) will be cancelled.`, [
      { text: 'Keep them', style: 'cancel' },
      { text: 'Cancel all', style: 'destructive', onPress: async () => {
        const result = await bulkCancelBookings(selectedIds);
        if (result.ok) { setSelectedIds([]); setSelectMode(false); reload(); }
        else Alert.alert('Could not cancel', result.error);
      }},
    ]);
  }

  async function handleBulkShift(minutes: number) {
    const result = await bulkShiftBookings(selectedIds, minutes);
    if (result.ok) { setSelectedIds([]); setSelectMode(false); reload(); }
    else Alert.alert('Could not shift', result.error);
  }

  const visibleBookings = selectedStaffId === 'all'
    ? bookings
    : bookings.filter(b => b.staff_id === selectedStaffId);

  const isToday = toDateKey(new Date()) === dateKey;
  const schedule = business ? dayScheduleFor(business.week_schedule, date) : null;
  const emptySpaces = schedule ? findEmptySpaces(visibleBookings, schedule) : [];
  const alerts = schedule ? computeCalendarAlerts(visibleBookings, schedule) : [];

  return (
    <View style={styles.container}>
      <OwnerScreenHeader
        title="Calendar"
        onCreatePress={() => {
          console.log('[DIAG] Calendar header + pressed', { walkInRefIsNull: walkInRef.current == null });
          walkInRef.current?.present();
        }}
        onNotificationsPress={() => router.push('/owner-notifications' as never)}
      />

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDay(-1)}><Text style={styles.dateNav}>← Yesterday</Text></TouchableOpacity>
        <Text style={styles.dateLabel}>{isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => shiftDay(1)}><Text style={styles.dateNav}>Tomorrow →</Text></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, alignItems: 'center' }}>
        {MODES.map(m => (
          <TouchableOpacity key={m.key} style={[styles.modeChip, mode === m.key && styles.modeChipActive]} onPress={() => setMode(m.key)}>
            <Text style={[styles.modeChipText, mode === m.key && styles.modeChipTextActive]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {mode === 'day' && (
        <View style={styles.staffSelectorRow}>
          <StaffChip label="All" active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} />
          {staff.map(s => (
            <StaffChip key={s.id} label={s.name} active={selectedStaffId === s.id} onPress={() => setSelectedStaffId(s.id)} />
          ))}
          <TouchableOpacity style={styles.walkInButton} onPress={() => walkInRef.current?.present()}>
            <Ionicons name="walk-outline" size={14} color={Colors.primary} />
            <Text style={styles.walkInText}>Walk-In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.selectButton} onPress={() => { setSelectMode(v => !v); setSelectedIds([]); }}>
            <Text style={styles.selectButtonText}>{selectMode ? 'Done' : 'Select'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'day' && alerts.length > 0 && (
        <View style={styles.alertsWrap}>
          {alerts.map((a, i) => (
            <View key={i} style={[styles.alertBanner, a.severity === 'warning' && styles.alertBannerWarning]}>
              <Text style={styles.alertText}>{a.message}</Text>
            </View>
          ))}
        </View>
      )}

      {mode === 'day' && emptySpaces.filter(g => g.durationMinutes >= 30).length > 0 && (
        <View style={styles.alertsWrap}>
          {emptySpaces.filter(g => g.durationMinutes >= 30).slice(0, 2).map((g, i) => (
            <TouchableOpacity key={i} style={styles.gapBanner} onPress={() => walkInRef.current?.present()}>
              <Text style={styles.gapText}>{Math.round(g.durationMinutes / 60 * 10) / 10}h opening at {formatMinutesAsTime(g.startMinutes)} — worth filling. Tap to book.</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {businessError ? (
        <ErrorState message={`Couldn't load your business settings: ${businessError}`} onRetry={loadBusiness} />
      ) : loading || !business || !schedule ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : mode === 'day' ? (
        <TimelineCalendar
          date={date}
          bookings={visibleBookings}
          staff={staff}
          selectedStaffId={selectedStaffId}
          weekSchedule={business.week_schedule}
          onOpenBooking={openBooking}
          onChanged={reload}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      ) : mode === 'agenda' ? (
        <AgendaView bookings={visibleBookings} onOpen={openBooking} />
      ) : mode === 'timeline' ? (
        <TimelineStripView bookings={visibleBookings} schedule={schedule} onOpen={openBooking} />
      ) : mode === 'month' ? (
        <MonthView month={date} onSelectDate={handleSelectDateFromMonth} />
      ) : (
        <MultiDayView startDate={date} numDays={mode === 'week' ? 7 : 3} onOpen={openBooking} />
      )}

      {selectMode && selectedIds.length > 0 && (
        <View style={styles.bulkBar}>
          <Text style={styles.bulkCount}>{selectedIds.length} selected</Text>
          <TouchableOpacity onPress={() => handleBulkShift(15)}><Text style={styles.bulkAction}>+15 min</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => handleBulkShift(-15)}><Text style={styles.bulkAction}>-15 min</Text></TouchableOpacity>
          <TouchableOpacity onPress={handleBulkCancel}><Text style={[styles.bulkAction, { color: Colors.error }]}>Cancel all</Text></TouchableOpacity>
        </View>
      )}

      <AppointmentSheet ref={sheetRef} booking={selectedBooking} onChanged={handleChanged} onReadyForCheckout={handleReadyForCheckout} />
      <CheckoutSheet ref={checkoutRef} booking={selectedBooking} onDone={handleCheckoutDone} />
      <WalkInSheet ref={walkInRef} staff={staff} todaysBookings={bookings} onBooked={handleWalkInBooked} />
    </View>
  );
}

function StaffChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
  },
  dateNav: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  dateLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  modeRow: { flexGrow: 0, height: 40, marginBottom: Spacing.sm },
  modeChip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center' },
  modeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  modeChipText: { fontSize: 12.5, lineHeight: 16, color: Colors.textPrimary, fontWeight: '600' },
  modeChipTextActive: { color: Colors.textOnPrimary },
  staffSelectorRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: Colors.textOnPrimary },
  walkInButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  walkInText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  selectButton: { paddingHorizontal: Spacing.sm, paddingVertical: 6 },
  selectButtonText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700' },
  alertsWrap: { paddingHorizontal: Spacing.lg, gap: 6, marginBottom: Spacing.sm },
  alertBanner: { backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  alertBannerWarning: { backgroundColor: '#FFF4E5' },
  alertText: { fontSize: 12.5, color: Colors.textPrimary },
  gapBanner: { backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  gapText: { fontSize: 12.5, color: Colors.primary, fontWeight: '600' },
  bulkBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg,
    backgroundColor: Colors.card, padding: Spacing.md, ...Shadows.button, justifyContent: 'space-between',
  },
  bulkCount: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  bulkAction: { fontSize: 13.5, color: Colors.primary, fontWeight: '700' },
});
