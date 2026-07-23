import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { CheckoutSheet, CheckoutSheetHandle } from '@/components/owner/CheckoutSheet';
import { WalkInSheet } from '@/components/owner/WalkInSheet';
import { TimelineCalendar } from '@/components/owner/TimelineCalendar';
import { MonthView } from '@/components/owner/MonthView';
import { MultiDayView } from '@/components/owner/MultiDayView';
import { useOwnerBookings } from '@/lib/calendar/useOwnerBookings';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { getBusiness, Business } from '@/lib/api/ownerBusiness';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { dayScheduleFor, localDateKey } from '@/lib/calendar/timeGrid';
import { ErrorState } from '@/components/ErrorState';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

const toDateKey = localDateKey;
const gridIntervalKey = (businessId: string) => `calendar_grid_interval_${businessId}`;

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// The old separate "Timeline" mode (a compact single-row day overview) was
// dropped once the Today grid got a real live "now" line -- that covered
// the same "where are we right now" need this mode existed for.
type CalendarMode = '3day' | 'week' | 'month' | 'agenda';
const MODES: { key: CalendarMode; label: string }[] = [
  { key: 'agenda', label: 'Today' }, { key: '3day', label: '3-Day' }, { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

// Day view (Phase 0.3 default) — full hour-grid timeline with drag-to-move,
// pinch-to-zoom, and swipe gestures. Five more modes for viewing/navigating
// (Sprint 6): 3-Day, Week, Month, Agenda, Timeline.
export default function OwnerCalendarScreen() {
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('agenda');
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessError, setBusinessError] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all');
  const [gridInterval, setGridInterval] = useState<15 | 30 | 60>(60);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  // Set when a specific empty grid slot was tapped, so the Walk-In sheet
  // books for that exact time/staff instead of "earliest available now".
  // Cleared before any generic Walk-In entry point (header/nav button).
  const [walkInPrefill, setWalkInPrefill] = useState<{ startsAt: Date; staffId: string | null; outsideHours?: boolean } | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const walkInRef = useRef<BottomSheetModal>(null);
  const checkoutRef = useRef<CheckoutSheetHandle>(null);

  const dateKey = toDateKey(date);
  const { bookings, loading, reload } = useOwnerBookings(dateKey);

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

  // A single-staff salon has no real use for "All" vs. the one person --
  // default straight to them instead of the generic "All" chip. Only
  // auto-selects once so it doesn't fight a manual switch back to "All"
  // later (e.g. after staff are added).
  const staffAutoSelected = useRef(false);
  useEffect(() => {
    if (staff.length === 1 && !staffAutoSelected.current) {
      staffAutoSelected.current = true;
      setSelectedStaffId(staff[0].id);
    }
  }, [staff]);

  // Remember the chosen grid interval per salon so it survives a reload,
  // instead of always resetting to the 1h default.
  useEffect(() => {
    if (!business) return;
    AsyncStorage.getItem(gridIntervalKey(business.id)).then(v => {
      if (v === '15' || v === '30' || v === '60') setGridInterval(Number(v) as 15 | 30 | 60);
    });
  }, [business?.id]);

  function handleSetGridInterval(mins: 15 | 30 | 60) {
    setGridInterval(mins);
    if (business) AsyncStorage.setItem(gridIntervalKey(business.id), String(mins));
  }

  function shiftDay(delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    setDate(next);
  }

  function openBooking(b: OwnerBooking) {
    setSelectedBooking(b);
    sheetRef.current?.present();
  }

  function handleViewFullDay(d: Date) {
    setDate(d);
    setMode('agenda');
  }

  function handleFillSlotOnDate(d: Date, outsideHours?: boolean) {
    // Load that day's bookings (needed for accurate conflict-checking if
    // it's not the currently-loaded day) and book directly -- previously
    // this only opened Walk-In when the tapped day happened to already
    // match the loaded date, and silently just switched to Day view for
    // every other column in the Week grid instead of booking.
    if (toDateKey(d) !== dateKey) setDate(d);
    // Week/3-Day's columns merge all staff together, so there's no
    // specific staff to attribute the tap to -- WalkInSheet will still
    // pick whichever staff is actually free at this exact time.
    setWalkInPrefill({ startsAt: d, staffId: null, outsideHours });
    walkInRef.current?.present();
  }

  function openWalkInFor(startsAt: Date, staffId: string | null, outsideHours?: boolean) {
    setWalkInPrefill({ startsAt, staffId, outsideHours });
    walkInRef.current?.present();
  }

  function openWalkInGeneric() {
    setWalkInPrefill(null);
    walkInRef.current?.present();
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
    setWalkInPrefill(null);
    reload();
  }, [reload]);

  const visibleBookings = selectedStaffId === 'all'
    ? bookings
    : bookings.filter(b => b.staff_id === selectedStaffId);

  const isToday = toDateKey(new Date()) === dateKey;
  const schedule = business ? dayScheduleFor(business.week_schedule, date) : null;

  const chipRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, alignItems: 'center' }}>
      {MODES.map(m => (
        <Pressable key={m.key} style={[styles.modeChip, mode === m.key && styles.modeChipActive]} onPress={() => setMode(m.key)}>
          <Text style={[styles.modeChipText, mode === m.key && styles.modeChipTextActive]}>{m.label}</Text>
        </Pressable>
      ))}

      {(mode === 'agenda' || mode === '3day' || mode === 'week') && (
        <View style={styles.rowDivider} />
      )}
      {(mode === 'agenda' || mode === '3day' || mode === 'week') && ([15, 30, 60] as const).map(mins => (
        <Pressable
          key={mins}
          style={[styles.intervalChip, gridInterval === mins && styles.intervalChipActive]}
          onPress={() => handleSetGridInterval(mins)}
        >
          <Text style={[styles.intervalChipText, gridInterval === mins && styles.intervalChipTextActive]}>
            {mins === 60 ? '1h' : `${mins}m`}
          </Text>
        </Pressable>
      ))}

      {mode === 'agenda' && <View style={styles.rowDivider} />}
      {mode === 'agenda' && (
        <>
          <StaffChip label="All" active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} />
          {staff.map(s => (
            <StaffChip key={s.id} label={s.name} active={selectedStaffId === s.id} onPress={() => setSelectedStaffId(s.id)} />
          ))}
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <OwnerScreenHeader
        title="Calendar"
        onCreatePress={openWalkInGeneric}
        onNotificationsPress={() => router.push('/owner-notifications' as never)}
      />

      <View style={styles.dateRow}>
        <Pressable onPress={() => shiftDay(-1)}><Text style={styles.dateNav}>← Yesterday</Text></Pressable>
        <Text style={styles.dateLabel}>{isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        <Pressable onPress={() => shiftDay(1)}><Text style={styles.dateNav}>Tomorrow →</Text></Pressable>
      </View>

      {/* Mode switcher, interval picker, and staff filter all share one
          horizontally-scrollable row -- previously up to 3 stacked rows,
          which ate too much vertical space above the actual grid.
          3-Day mode wraps this row in a glass panel (Option B) instead of
          leaving it directly on the animated background (Option A, used
          everywhere else) -- a live side-by-side comparison of the two
          chrome treatments while the grid itself stays opaque either way. */}
      {mode === '3day' && (
        <View style={styles.chromeGlassWrap}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <CardOverlay />
          {chipRow}
        </View>
      )}
      {mode !== '3day' && chipRow}

      {businessError ? (
        <ErrorState message={`Couldn't load your business settings: ${businessError}`} onRetry={loadBusiness} />
      ) : loading || !business || !schedule ? (
        <View style={styles.centered}><BreathingHeart size={40} color={P.accentGold} /></View>
      ) : mode === 'agenda' ? (
        // Option A: the grid sits on a fully opaque panel, so the animated
        // background only shows in the margins/chrome above -- the working
        // area (gridlines, tiny drag targets, avatar chips) reads exactly
        // as legibly as before instead of the background bleeding through
        // every empty cell.
        <View style={styles.opaqueGridPanel}>
          <TimelineCalendar
            date={date}
            bookings={visibleBookings}
            staff={staff}
            selectedStaffId={selectedStaffId}
            weekSchedule={business.week_schedule}
            onOpenBooking={openBooking}
            onChanged={reload}
            onFillSlot={openWalkInFor}
            intervalMinutes={gridInterval}
          />
        </View>
      ) : mode === 'month' ? (
        <MonthView month={date} weekSchedule={business.week_schedule} onOpenBooking={openBooking} onViewFullDay={handleViewFullDay} />
      ) : mode === '3day' ? (
        // Option B: same opaque grid panel as Today, but the chrome row
        // above got the glass treatment instead (see the merged chip row).
        <View style={styles.opaqueGridPanel}>
          <MultiDayView startDate={date} numDays={3} weekSchedule={business.week_schedule} selectedStaffId={selectedStaffId} onOpen={openBooking} onFillSlot={handleFillSlotOnDate} intervalMinutes={gridInterval} />
        </View>
      ) : (
        <MultiDayView startDate={date} numDays={7} weekSchedule={business.week_schedule} selectedStaffId={selectedStaffId} onOpen={openBooking} onFillSlot={handleFillSlotOnDate} intervalMinutes={gridInterval} />
      )}

      <AppointmentSheet ref={sheetRef} booking={selectedBooking} onChanged={handleChanged} onReadyForCheckout={handleReadyForCheckout} />
      <CheckoutSheet ref={checkoutRef} booking={selectedBooking} onDone={handleCheckoutDone} />
      <WalkInSheet
        ref={walkInRef}
        staff={staff}
        todaysBookings={bookings}
        onBooked={handleWalkInBooked}
        initialTime={walkInPrefill?.startsAt ?? null}
        initialStaffId={walkInPrefill?.staffId}
        outsideBusinessHours={walkInPrefill?.outsideHours}
      />
    </View>
  );
}

function StaffChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
  },
  dateNav: { fontSize: 13, color: P.accentGold, fontWeight: '600' },
  dateLabel: { fontSize: 15, fontWeight: '700', color: P.textPrimary },
  chromeGlassWrap: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: BorderRadius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
  },
  opaqueGridPanel: { flex: 1, backgroundColor: P.background },
  modeRow: { flexGrow: 0, height: 34, marginBottom: Spacing.sm },
  modeChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, justifyContent: 'center',
  },
  modeChipActive: { backgroundColor: P.darkGold, borderColor: P.accentGold },
  modeChipText: { fontSize: 11.5, lineHeight: 14, color: P.textSecondary, fontWeight: '600' },
  modeChipTextActive: { color: P.background },
  rowDivider: { width: 1, height: 16, backgroundColor: P.border },
  intervalChip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
  },
  intervalChipActive: { backgroundColor: P.darkGold, borderColor: P.accentGold },
  intervalChipText: { fontSize: 11, color: P.textSecondary, fontWeight: '600' },
  intervalChipTextActive: { color: P.background },
  chip: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
  },
  chipActive: { backgroundColor: P.primaryPurple, borderColor: P.secondaryPurple },
  chipText: { fontSize: 11.5, color: P.textSecondary, fontWeight: '600' },
  chipTextActive: { color: P.textPrimary },
});
