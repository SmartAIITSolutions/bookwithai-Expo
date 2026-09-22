import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, Pressable, StyleSheet, ScrollView, Modal, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { CalendarDatePicker } from '@/components/owner/CalendarDatePicker';
import { FreshaDatePicker } from '@/components/owner/FreshaDatePicker';
import { MonthView } from '@/components/owner/MonthView';
import { MultiDayView } from '@/components/owner/MultiDayView';
import { QueueFlowView } from '@/components/owner/QueueFlowView';
import { useOwnerBookings } from '@/lib/calendar/useOwnerBookings';
import { listStaff } from '@/lib/api/ownerStaff';
import { getBusiness } from '@/lib/api/ownerBusiness';
import { OwnerBooking, getBooking, blockTime, updateBooking } from '@/lib/api/ownerBookings';
import { listServices } from '@/lib/api/ownerServices';
import { CustomerLite } from '@/lib/api/ownerCustomers';
import { zonedDateKey, zonedHeaderLabels, dayScheduleForZoned } from '@/lib/calendar/timeGrid';
import { BookingSource, SOURCE_COLOR, PaymentBadge, PAYMENT_COLOR } from '@/lib/calendar/appointmentVisual';
import { ALL_STATUS_KEYS, STATUS_COLOR, statusLabel } from '@/lib/calendar/bookingStatus';
import { CalendarFilters, emptyFilters, isFiltersActive, activeFilterCount, bookingMatchesFilters } from '@/lib/calendar/bookingFilters';
import { buildSampleDay, buildLateSampleBooking, isSampleBooking } from '@/lib/calendar/sampleDayFixture';
import { getDaySampleMode, setDaySampleMode } from '@/lib/calendar/daySampleMode';
import { ErrorState } from '@/components/ErrorState';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Trans, useTranslation } from 'react-i18next';
import { formatMonthYearLong, formatMonthDay, formatTimeShortInTZ, formatWeekdayMonthDayYearInTZ } from '@/lib/i18n/format';

const gridIntervalKey = (businessId: string) => `calendar_grid_interval_${businessId}`;
const selectedStaffKey = (businessId: string) => `calendar_selected_staff_${businessId}`;

function roundToNext15(d: Date): Date {
  const next = new Date(d);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15);
  return next;
}

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
type CalendarMode = '3day' | 'week' | 'month' | 'agenda' | 'queue';

// i18n foundation (L5B) -- `key` is the stable canonical view identifier
// used for all mode-switching logic; `label` is presentation only. Built as
// functions (not module-level constants) so `label` can call t().
function buildModes(t: ReturnType<typeof useTranslation<['calendar']>>['t']): { key: CalendarMode; label: string }[] {
  return [
    { key: 'agenda', label: t('calendar:screen.modeToday') }, { key: 'queue', label: t('calendar:screen.modeQueue') }, { key: '3day', label: t('calendar:screen.mode3Day') },
    { key: 'week', label: t('calendar:screen.modeWeek') }, { key: 'month', label: t('calendar:screen.modeMonth') },
  ];
}

// Calendar 2.0 Day View — Part 2's exact segmented control: Day/3-Day/Week/
// Month only. Queue is intentionally excluded -- it's not one of the
// reference's four segments; it's still reachable from 3-Day/Week/Month's
// own (unchanged) mode row.
function buildDaySegmentModes(t: ReturnType<typeof useTranslation<['calendar']>>['t']): { key: CalendarMode; label: string }[] {
  return [
    { key: 'agenda', label: t('calendar:screen.modeDay') }, { key: '3day', label: t('calendar:screen.mode3Day') },
    { key: 'week', label: t('calendar:screen.modeWeek') }, { key: 'month', label: t('calendar:screen.modeMonth') },
  ];
}

// Day view (Phase 0.3 default) — full hour-grid timeline with drag-to-move,
// pinch-to-zoom, and swipe gestures. Five more modes for viewing/navigating
// (Sprint 6): 3-Day, Week, Month, Agenda, Timeline.
export default function OwnerCalendarScreen() {
  const { t } = useTranslation(['calendar']);
  const MODES = buildModes(t);
  const DAY_SEGMENT_MODES = buildDaySegmentModes(t);
  // Display-only translated labels for the canonical BLOCK_REASON_PRESETS values
  // (see NOTE at the reason pill row below).
  const REASON_LABELS: Record<typeof BLOCK_REASON_PRESETS[number], string> = {
    Meeting: t('calendar:screen.reasonOptions.Meeting'),
    Lunch: t('calendar:screen.reasonOptions.Lunch'),
    Personal: t('calendar:screen.reasonOptions.Personal'),
    Training: t('calendar:screen.reasonOptions.Training'),
    Cleaning: t('calendar:screen.reasonOptions.Cleaning'),
    Break: t('calendar:screen.reasonOptions.Break'),
    Other: t('calendar:screen.reasonOptions.Other'),
  };
  const [date, setDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('agenda');
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all');
  // Calendar parity pass (audit §08) — the four new filter dimensions
  // (status/channel/payment/services) that were previously only a read-only
  // color legend. Session-only (not persisted like the staff filter) --
  // these are meant as a temporary "show me X right now" lens, not a
  // sticky default that could silently hide bookings on the next visit.
  const [filters, setFilters] = useState<CalendarFilters>(emptyFilters());
  const [gridInterval, setGridInterval] = useState<15 | 30 | 60>(60);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  // Set when a specific empty grid slot was tapped, so the Walk-In sheet
  // books for that exact time/staff instead of "earliest available now".
  // Cleared before any generic Walk-In entry point (header/nav button).
  const [walkInPrefill, setWalkInPrefill] = useState<{ startsAt: Date; staffId: string | null; outsideHours?: boolean } | null>(null);
  // Fresha-parity pass — "New Appointment" and "Walk-in" now open the same
  // sheet with a genuinely different starting point (see WalkInSheet's own
  // `mode` prop comment) instead of being silently identical. Defaults to
  // 'new' since that's the more capable starting point (customer search) --
  // every generic/unlabeled entry point falls back to it.
  const [walkInFlowMode, setWalkInFlowMode] = useState<'new' | 'walkIn'>('new');
  // Set when arriving from a customer profile's "Book" action -- stays
  // pending (shown as a dismissible banner) across mode switches and date
  // navigation until the owner actually taps a slot to book, or a booking
  // completes, so drilling into Week/Month to find a day doesn't lose it.
  const [bookingForCustomer, setBookingForCustomer] = useState<CustomerLite | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const walkInRef = useRef<BottomSheetModal>(null);
  const checkoutRef = useRef<CheckoutSheetHandle>(null);

  // Calendar 2.0 Day View — Parts 35/36 dev-only sample fixture toggle, so
  // every card visual state (source/status/payment color) can be reviewed
  // without depending on which real bookings happen to exist today. Never
  // affects any other screen -- purely swaps what this screen renders.
  const [sampleMode, setSampleMode] = useState(false);
  useEffect(() => { getDaySampleMode().then(setSampleMode); }, []);

  const [staffPickerOpen, setStaffPickerOpen] = useState(false);
  const [intervalPickerOpen, setIntervalPickerOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Calendar 2.0 Day View Parts 4/16 — tapping an empty slot (or the header
  // "+") opens this compact menu instead of jumping straight to Walk-In, so
  // Block Time is reachable from the same entry points the spec calls for.
  const [slotMenu, setSlotMenu] = useState<{ startsAt: Date; staffId: string | null; outsideHours?: boolean } | null>(null);
  const [slotMenuOpen, setSlotMenuOpen] = useState(false);

  // Calendar 2.0 Day View Part 15 — Block Time, reusing the existing
  // source='time_block' mechanism (blockTime() for creating, the same
  // updateBooking()/cancelBooking() every real booking uses for editing/
  // deleting an existing one -- confirmed by reading booking-app's PATCH
  // route that it never branches on `source`, so it already works
  // generically for a time_block row).
  // `blockEditingId` null = creating a new block; set = editing an existing
  // one (opened by tapping a Block Time card on the grid).
  const [blockEditingId, setBlockEditingId] = useState<string | null>(null);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [blockDate, setBlockDate] = useState<Date>(new Date());
  const [blockFrom, setBlockFrom] = useState<Date>(new Date());
  const [blockTo, setBlockTo] = useState<Date>(new Date());
  const [blockStaffId, setBlockStaffId] = useState<string | 'any'>('any');
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [blockNote, setBlockNote] = useState('');
  const [blockSaving, setBlockSaving] = useState(false);
  const [blockDeleting, setBlockDeleting] = useState(false);
  const [blockDatePickerOpen, setBlockDatePickerOpen] = useState(false);
  const [blockTimeFieldOpen, setBlockTimeFieldOpen] = useState<'from' | 'to' | null>(null);
  const BLOCK_REASON_PRESETS = ['Meeting', 'Lunch', 'Personal', 'Training', 'Cleaning', 'Break', 'Other'] as const;

  // Caching pass — these three used to bypass React Query (plain useState
  // + a fresh fetch in a useEffect on every Calendar mount), duplicating
  // whatever Dashboard had already fetched moments earlier instead of
  // sharing it. `business`/`staff` now reuse Dashboard's own exact query
  // keys (dashboard.tsx's businessQuery/staffQuery) -- visiting either
  // screen after the other reads the same cached data instead of
  // re-fetching. `services` is new to this screen (only Calendar's filter
  // sheet needs it) but still benefits from the shared 30s staleTime on
  // Calendar's own repeat visits/mode switches.
  const businessQuery = useQuery({ queryKey: ['owner-business'], queryFn: async () => {
    const r = await getBusiness();
    if (!r.ok) throw new Error(r.error);
    return r.data.business;
  } });
  const staffQuery = useQuery({ queryKey: ['owner-staff'], queryFn: async () => {
    const r = await listStaff();
    if (!r.ok) throw new Error(r.error);
    return r.data.data;
  } });
  const servicesQuery = useQuery({ queryKey: ['owner-services'], queryFn: async () => {
    const r = await listServices();
    if (!r.ok) throw new Error(r.error);
    return r.data.data;
  } });
  const business = businessQuery.data ?? null;
  const businessError = businessQuery.error instanceof Error ? businessQuery.error.message : null;
  const staff = (staffQuery.data ?? []).filter(s => s.active);
  const services = (servicesQuery.data ?? []).filter(s => s.active);
  const loadBusiness = useCallback(() => { businessQuery.refetch(); }, [businessQuery]);

  // Calendar 2.0 Part 1 — the salon's own timezone, not the device's.
  // Falls back to the same default the backend itself uses when a salon
  // hasn't set one (src/lib/salon-timezone.ts), so Day/Queue's date key
  // always matches what the server resolves it to.
  const timeZone = business?.iana_timezone || 'America/Chicago';
  const dateKey = zonedDateKey(date, timeZone);
  const { bookings, loading, reload } = useOwnerBookings(dateKey);

  // Deep link from Dashboard's quick-view popup ("tap the customer's name")
  // -- jumps to this specific booking's day and opens the same
  // AppointmentSheet here, where drag-to-reschedule and the rest of the
  // real calendar grid are actually available. A ref guards against
  // re-opening on every re-render/refocus once the params have been
  // consumed once.
  const { openBookingId, date: openDateParam } = useLocalSearchParams<{ openBookingId?: string; date?: string }>();
  const handledOpenBookingId = useRef<string | null>(null);
  useEffect(() => {
    if (!openBookingId || handledOpenBookingId.current === openBookingId) return;
    handledOpenBookingId.current = openBookingId;
    if (openDateParam) {
      const [y, m, d] = openDateParam.split('-').map(Number);
      if (y && m && d) setDate(new Date(y, m - 1, d));
    }
    getBooking(openBookingId).then(result => {
      if (result.ok) {
        setSelectedBooking(result.data.data);
        sheetRef.current?.present();
      }
    });
  }, [openBookingId, openDateParam]);

  // Deep link from a customer profile's "Book" action -- carries that
  // customer's identity over so it's pre-selected the moment a slot is
  // tapped, instead of landing on an empty Calendar with no memory of which
  // customer the owner meant to book.
  const { bookCustomerId, bookCustomerName, bookCustomerPhone, bookCustomerEmail } = useLocalSearchParams<{
    bookCustomerId?: string; bookCustomerName?: string; bookCustomerPhone?: string; bookCustomerEmail?: string;
  }>();
  const handledBookCustomerId = useRef<string | null>(null);
  useEffect(() => {
    if (!bookCustomerId || handledBookCustomerId.current === bookCustomerId) return;
    handledBookCustomerId.current = bookCustomerId;
    setBookingForCustomer({
      id: bookCustomerId,
      name: bookCustomerName ?? 'Customer',
      phone: bookCustomerPhone || null,
      email: bookCustomerEmail || null,
    });
  }, [bookCustomerId, bookCustomerName, bookCustomerPhone, bookCustomerEmail]);

  // Keep the open Appointment Sheet's booking in sync with fresh data --
  // without this, actions like Check-In/No-Show correctly update the
  // backend and refetch `bookings`, but the sheet keeps rendering the
  // stale object it was opened with, looking like the action did nothing.
  useEffect(() => {
    if (!selectedBooking) return;
    const fresh = bookings.find(b => b.id === selectedBooking.id);
    if (fresh && fresh !== selectedBooking) setSelectedBooking(fresh);
  }, [bookings, selectedBooking]);

  // Toggles one value within one filter dimension -- checking a second box
  // in the same section (e.g. "SANAA" + "Walk-in" under Channel) is an OR
  // within that axis; a box checked in a different section is an AND across
  // axes (see bookingFilters.ts's own comment for the exact semantics).
  function toggleFilter<K extends keyof CalendarFilters>(dimension: K, value: CalendarFilters[K] extends Set<infer V> ? V : never) {
    setFilters(prev => {
      const next = new Set(prev[dimension] as Set<typeof value>);
      if (next.has(value)) next.delete(value); else next.add(value);
      return { ...prev, [dimension]: next };
    });
  }

  function clearFilters() {
    setFilters(emptyFilters());
  }

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

  // Remember the last-selected staff filter per salon, same pattern as the
  // grid interval below -- previously this always reset to "All" on every
  // screen mount (app restart, or navigating away and back), even right
  // after an owner had deliberately switched to one person. Only restores
  // once staff has actually loaded, so a persisted id can be checked
  // against who's still active (a staff member removed since the last
  // visit falls back to "All" instead of silently filtering to nobody).
  const staffRestored = useRef(false);
  useEffect(() => {
    if (!business || staff.length === 0 || staffRestored.current) return;
    staffRestored.current = true;
    AsyncStorage.getItem(selectedStaffKey(business.id)).then(v => {
      if (v && staff.some(s => s.id === v)) {
        staffAutoSelected.current = true; // a real persisted choice beats the single-staff auto-select above
        setSelectedStaffId(v);
      }
    });
  }, [business, staff]);

  function handleSetSelectedStaffId(id: string | 'all') {
    setSelectedStaffId(id);
    if (business) AsyncStorage.setItem(selectedStaffKey(business.id), id);
  }

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

  // Previously always shifted by exactly 1 day regardless of which grid was
  // showing -- harmless in Today/3-Day, but in Week mode it took 7 taps to
  // page one week, and in Month mode up to ~30 taps to page one month. Now
  // matches the step size to what's actually on screen.
  function shiftView(delta: number) {
    if (mode === 'week') {
      shiftDay(delta * 7);
    } else if (mode === '3day') {
      shiftDay(delta * 3);
    } else if (mode === 'month') {
      const next = new Date(date);
      next.setDate(1); // avoid month-end rollover (e.g. Jan 31 + 1 month skipping to March)
      next.setMonth(next.getMonth() + delta);
      setDate(next);
    } else {
      shiftDay(delta);
    }
  }

  function openBooking(b: OwnerBooking) {
    setSelectedBooking(b);
    sheetRef.current?.present();
  }

  // Day view only (see the TimelineCalendar onOpenBooking prop below) --
  // Week/3-Day/Month keep calling openBooking() directly, unchanged, since
  // this task is Day-view-only.
  function handleOpenBookingDay(b: OwnerBooking) {
    if (b.source === 'time_block') openBlockTimeEditor(b);
    else openBooking(b);
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
    if (zonedDateKey(d, timeZone) !== dateKey) setDate(d);
    // Week/3-Day's columns merge all staff together, so there's no
    // specific staff to attribute the tap to -- WalkInSheet will still
    // pick whichever staff is actually free at this exact time.
    setWalkInPrefill({ startsAt: d, staffId: null, outsideHours });
    setWalkInFlowMode('new');
    walkInRef.current?.present();
  }

  function openWalkInFor(startsAt: Date, staffId: string | null, outsideHours?: boolean, flowMode: 'new' | 'walkIn' = 'new') {
    setWalkInPrefill({ startsAt, staffId, outsideHours });
    setWalkInFlowMode(flowMode);
    walkInRef.current?.present();
  }

  // Day view's empty-slot tap and the header "+" both land here now
  // (Parts 4/16) -- a compact New Appointment / Walk-In / Block Time menu,
  // prepopulated with whatever date/time/staff was tapped.
  function openSlotMenu(startsAt: Date, staffId: string | null, outsideHours?: boolean) {
    setSlotMenu({ startsAt, staffId, outsideHours });
    setSlotMenuOpen(true);
  }

  // Combines dateOnly's own year/month/day with time's hour/minute -- used
  // when the owner changes the Date field without wanting to lose whatever
  // From/To time-of-day was already set.
  function withDate(time: Date, dateOnly: Date): Date {
    const next = new Date(time);
    next.setFullYear(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate());
    return next;
  }

  // Block Time correction pass — the From/To picker used to offer the
  // entire 24-hour day, including hours nothing could ever actually be
  // scheduled in. It's now bounded to real bookable time: the salon's own
  // operating hours (dayScheduleForZoned, already used elsewhere in this
  // file) intersected with the selected staff member's own working hours
  // for that date, when a specific staff member (not "Entire Business") is
  // selected.
  type BlockBounds =
    | { kind: 'closed' }
    | { kind: 'staffUnavailable'; staffName: string }
    | { kind: 'open'; startMin: number; endMin: number };

  function computeBlockBounds(dateOnly: Date, staffId: string | 'any'): BlockBounds {
    const daySchedule = dayScheduleForZoned(business?.week_schedule ?? null, dateOnly, timeZone);
    if (!daySchedule.open) return { kind: 'closed' };
    let startMin = daySchedule.start * 60;
    let endMin = daySchedule.end * 60;
    if (staffId !== 'any') {
      const s = staff.find(x => x.id === staffId);
      const entry = s?.availability.find(a => a.day_of_week === dateOnly.getDay() && a.is_working);
      if (!entry) return { kind: 'staffUnavailable', staffName: s?.name ?? t('calendar:screen.thisStaffMember') };
      const [sh, sm] = entry.start_time.split(':').map(Number);
      const [eh, em] = entry.end_time.split(':').map(Number);
      startMin = Math.max(startMin, sh * 60 + (sm || 0));
      endMin = Math.min(endMin, eh * 60 + (em || 0));
      if (startMin >= endMin) return { kind: 'staffUnavailable', staffName: s?.name ?? t('calendar:screen.thisStaffMember') };
    }
    return { kind: 'open', startMin, endMin };
  }

  // Every 15-minute time-of-day between minMinutes and maxMinutes
  // (inclusive), as real Date objects already anchored to the given day --
  // backs the From/To picker lists. No time-picker dependency exists in
  // this project (confirmed) and this is a small enough set that a plain
  // scrollable list is the simplest correct option, same Modal+PickerRow
  // pattern already used for Staff/Interval above.
  function timeOptionsInRange(dateOnly: Date, minMinutes: number, maxMinutes: number): Date[] {
    const base = new Date(dateOnly);
    base.setHours(0, 0, 0, 0);
    const options: Date[] = [];
    const start = Math.ceil(minMinutes / 15) * 15;
    for (let m = start; m <= maxMinutes; m += 15) options.push(new Date(base.getTime() + m * 60000));
    return options;
  }

  function minutesOfDay(d: Date): number {
    return d.getHours() * 60 + d.getMinutes();
  }

  // Part 6 — recompute the allowed range whenever Date or Staff changes,
  // and if the currently-selected From/To no longer fits, snap it to the
  // nearest valid start/end instead of silently leaving an invalid time
  // selected.
  function clampBlockTimesToBounds(dateOnly: Date, staffId: string | 'any', from: Date, to: Date): { from: Date; to: Date } {
    const bounds = computeBlockBounds(dateOnly, staffId);
    if (bounds.kind !== 'open') return { from, to };
    const base = new Date(dateOnly);
    base.setHours(0, 0, 0, 0);
    const duration = Math.max(15, Math.round((to.getTime() - from.getTime()) / 60000));
    let fromMin = Math.min(Math.max(minutesOfDay(from), bounds.startMin), bounds.endMin - 15);
    let toMin = Math.min(fromMin + duration, bounds.endMin);
    if (toMin - fromMin < 15) fromMin = toMin - 15;
    return { from: new Date(base.getTime() + fromMin * 60000), to: new Date(base.getTime() + toMin * 60000) };
  }

  function openBlockTimeFor(startsAt: Date, staffId: string | null) {
    const resolvedStaffId = staffId ?? 'any';
    const { from, to } = clampBlockTimesToBounds(startsAt, resolvedStaffId, startsAt, new Date(startsAt.getTime() + 30 * 60000));
    setBlockEditingId(null);
    setBlockDate(startsAt);
    setBlockFrom(from);
    setBlockTo(to);
    setBlockStaffId(resolvedStaffId);
    setBlockReason(null);
    setBlockNote('');
    setBlockSheetOpen(true);
  }

  // Part 6 — tapping an existing Block Time card opens this editor
  // (pre-filled from the real row) instead of AppointmentSheet, which is
  // built around customer appointments and doesn't apply here.
  function openBlockTimeEditor(booking: OwnerBooking) {
    const starts = new Date(booking.starts_at);
    const ends = new Date(booking.ends_at);
    setBlockEditingId(booking.id);
    setBlockDate(starts);
    setBlockFrom(starts);
    setBlockTo(ends);
    setBlockStaffId(booking.staff_id ?? 'any');
    const notes = booking.internal_notes ?? '';
    if ((BLOCK_REASON_PRESETS as readonly string[]).includes(notes)) { setBlockReason(notes); setBlockNote(''); }
    else { setBlockReason(notes ? 'Other' : null); setBlockNote(notes); }
    setBlockSheetOpen(true);
  }

  // Block Time is explicitly allowed to land on top of real appointments
  // (they're never touched, moved, or notified -- see block/route.ts's own
  // comment). The conflict check is a WARNING the owner can override, not
  // a hard rejection: on CONFLICT, show what's actually inside the
  // requested period and let the owner choose Cancel or Block Anyway,
  // which resubmits with override_conflict:true. Reuses each route's own
  // already-existing override mechanism (block/route.ts's new
  // override_conflict flag for creation; PATCH /api/owner/bookings/[id]'s
  // existing override_conflict, already used by move/resize, for editing)
  // -- no new conflict engine.
  async function submitBlockTime(overrideConflict = false) {
    if (blockEditingId && isSampleBooking(blockEditingId)) {
      Alert.alert(t('calendar:screen.sampleDataTitle'), t('calendar:screen.sampleDataBlockMessage'));
      return;
    }
    if (blockTo.getTime() <= blockFrom.getTime()) {
      Alert.alert(t('calendar:screen.invalidTimeRangeTitle'), t('calendar:screen.invalidTimeRangeMessage'));
      return;
    }
    const staffId = blockStaffId === 'any' ? null : blockStaffId;
    const internalNotes = blockReason === 'Other' ? (blockNote.trim() || 'Other') : blockReason;
    setBlockSaving(true);

    // Editing an existing block reuses the exact same PATCH every real
    // booking uses (updateBooking) -- confirmed by reading the backend
    // route that it never branches on `source`, so this already works
    // correctly for a time_block row without any backend change.
    const result = blockEditingId
      ? await updateBooking(blockEditingId, {
          starts_at: blockFrom.toISOString(), ends_at: blockTo.toISOString(),
          staff_id: staffId, internal_notes: internalNotes,
          ...(overrideConflict ? { override_conflict: true } : {}),
        })
      : await blockTime({
          starts_at: blockFrom.toISOString(),
          block_duration_minutes: Math.round((blockTo.getTime() - blockFrom.getTime()) / 60000),
          staff_id: staffId, notes: internalNotes,
          ...(overrideConflict ? { override_conflict: true } : {}),
        });

    setBlockSaving(false);
    if (result.ok) {
      setBlockSheetOpen(false);
      setBlockEditingId(null);
      reload();
      return;
    }
    if (result.code === 'CONFLICT') {
      // block/route.ts sends structured conflict detail (create path);
      // the generic PATCH route (edit path) doesn't, so this degrades to
      // a plain count-less confirm there -- still a real override, just
      // without the itemized list.
      const conflicts = (result as { conflicts?: { starts_at: string; label: string }[] }).conflicts;
      const conflictCount = (result as { conflictCount?: number }).conflictCount;
      const detail = conflicts?.length
        ? '\n\n' + conflicts.map(c => `${formatTimeShortInTZ(new Date(c.starts_at), timeZone)} — ${c.label}`).join('\n')
        : '';
      Alert.alert(
        conflictCount ? t('calendar:screen.conflictAppointmentsFall', { count: conflictCount }) : t('calendar:screen.timeSlotIsTaken'),
        `${conflicts?.length ? t('calendar:screen.conflictsWillStay') : t('calendar:screen.staffAlreadyBooked')}${detail}`,
        [
          { text: t('calendar:screen.cancel'), style: 'cancel' },
          { text: t('calendar:screen.blockAnyway'), style: 'destructive', onPress: () => submitBlockTime(true) },
        ],
      );
      return;
    }
    Alert.alert(blockEditingId ? t('calendar:screen.couldNotSaveChangesTitle') : t('calendar:screen.couldNotBlockTimeTitle'), result.error);
  }

  // Part 6 — "Delete Block". No DELETE route exists (confirmed); the
  // existing cancelBooking() (PATCH status='cancelled') is the same
  // mechanism every other booking cancellation already uses, and is
  // provably safe here: booking-app only sends a customer notification
  // when the row has a customer_id, and every time_block row is created
  // with customer_id=null (confirmed in block/route.ts) -- so cancelling
  // one never fires a customer-facing message. A cancelled row is also
  // already excluded from public availability (confirmed: both
  // availability routes filter status != 'cancelled' with no source
  // exception), so the slot opens back up immediately, no separate
  // "unblock" mechanism needed.
  async function deleteBlockTime() {
    if (!blockEditingId) return;
    if (isSampleBooking(blockEditingId)) {
      Alert.alert(t('calendar:screen.sampleDataTitle'), t('calendar:screen.sampleDataDeleteMessage'));
      return;
    }
    setBlockDeleting(true);
    const result = await updateBooking(blockEditingId, { status: 'cancelled' });
    setBlockDeleting(false);
    if (result.ok) {
      setBlockSheetOpen(false);
      setBlockEditingId(null);
      reload();
      return;
    }
    Alert.alert(t('calendar:screen.couldNotDeleteBlockTitle'), result.error);
  }

  function openWalkInGeneric(flowMode: 'new' | 'walkIn' = 'new') {
    setWalkInPrefill(null);
    setWalkInFlowMode(flowMode);
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

  // Queue view's "Ready to Pay" bucket opens Checkout directly, bypassing
  // AppointmentSheet entirely -- there's nothing left to see there once a
  // booking has already reached service_completed_at.
  function openForCheckout(b: OwnerBooking) {
    setSelectedBooking(b);
    checkoutRef.current?.present();
  }

  const handleCheckoutDone = useCallback(() => {
    checkoutRef.current?.dismiss();
    sheetRef.current?.dismiss();
    reload();
  }, [reload]);

  const handleWalkInBooked = useCallback(() => {
    walkInRef.current?.dismiss();
    setWalkInPrefill(null);
    setBookingForCustomer(null);
    reload();
  }, [reload]);

  // Sample mode (Day view only, __DEV__-gated) substitutes the deterministic
  // fixture for the real fetched bookings so every card visual state can be
  // reviewed -- never touches what reload()/mutations act on, since those
  // still read/write the real `bookings` from useOwnerBookings above.
  const dayBase = new Date(date); dayBase.setHours(0, 0, 0, 0);
  // The Late demo booking is anchored to real now() (see its own comment),
  // so it only belongs in the fixture when the displayed day actually is
  // today -- otherwise "25 minutes ago" would land on the wrong date.
  const effectiveBookings = mode === 'agenda' && sampleMode
    ? [...buildSampleDay(dayBase), ...(zonedDateKey(new Date(), timeZone) === dateKey ? [buildLateSampleBooking()] : [])]
    : bookings;

  // Unassigned bookings (staff_id null -- e.g. a customer-initiated booking
  // that never got a staff pick) still need to show up when a specific
  // staff is selected, not just under "All" -- otherwise a single-staff
  // salon (which auto-selects its own column) silently loses them off the
  // grid entirely, with no way to see or claim them.
  const visibleBookings = effectiveBookings
    .filter(b => selectedStaffId === 'all' || b.staff_id === selectedStaffId || b.staff_id === null)
    .filter(b => bookingMatchesFilters(b, filters));

  const isToday = zonedDateKey(new Date(), timeZone) === dateKey;
  const schedule = business ? dayScheduleForZoned(business.week_schedule, date, timeZone) : null;

  function handleModePress(key: CalendarMode) {
    // "Today" is really just this mode switcher's chip for Day view -- its
    // label promises the actual current date, but switching modes alone
    // never touched `date`, so wandering off into Month/Week and tapping
    // back to "Today" landed on whatever date was last viewed there
    // instead of resetting to today.
    if (key === 'agenda') setDate(new Date());
    setMode(key);
  }

  const chipRow = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeRow} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: 6, alignItems: 'center' }}>
      {MODES.map(m => (
        <Pressable key={m.key} style={[styles.modeChip, mode === m.key && styles.modeChipActive]} onPress={() => handleModePress(m.key)}>
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
          <StaffChip label={t('calendar:screen.all')} active={selectedStaffId === 'all'} onPress={() => handleSetSelectedStaffId('all')} />
          {staff.map(s => (
            <StaffChip key={s.id} label={s.name} active={selectedStaffId === s.id} onPress={() => handleSetSelectedStaffId(s.id)} />
          ))}
        </>
      )}
    </ScrollView>
  );

  // Calendar 2.0 Day View — Parts 2/9/30. The reference's control bar is
  // four DISTINCT controls, not one flat row of same-looking chips: a staff
  // filter, a Day/3-Day/Week/Month view switcher (Queue is deliberately not
  // one of its options -- it's reached from another mode's own row, same as
  // before), an interval picker, and a filter/legend icon. Replaces the
  // shared chipRow for Day view only; 3-Day/Week/Month/Queue keep chipRow
  // exactly as it was (out of scope for this screen).
  const selectedStaffLabel = selectedStaffId === 'all' ? t('calendar:screen.allStaff') : (staff.find(s => s.id === selectedStaffId)?.name ?? t('calendar:screen.staffFallback'));
  const blockBounds = computeBlockBounds(blockDate, blockStaffId);
  const dayControlBar = (
    <View style={styles.dayControlRow}>
      <Pressable style={styles.dayControlPill} onPress={() => setStaffPickerOpen(true)}>
        <Ionicons name="people-outline" size={13} color={P.textSecondary} />
        <Text style={styles.dayControlPillText} numberOfLines={1}>{selectedStaffLabel}</Text>
        <Ionicons name="chevron-down" size={13} color={P.textSecondary} />
      </Pressable>

      <View style={styles.daySegmentGroup}>
        {DAY_SEGMENT_MODES.map(m => (
          <Pressable key={m.key} style={[styles.daySegmentChip, mode === m.key && styles.daySegmentChipActive]} onPress={() => handleModePress(m.key)}>
            <Text style={[styles.daySegmentChipText, mode === m.key && styles.daySegmentChipTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.dayControlPill} onPress={() => setIntervalPickerOpen(true)}>
        <Text style={styles.dayControlPillText}>{gridInterval === 60 ? '1h' : `${gridInterval}m`}</Text>
        <Ionicons name="chevron-down" size={12} color={P.textSecondary} />
      </Pressable>

      <Pressable style={styles.dayFilterIconBtn} onPress={() => setFilterSheetOpen(true)}>
        <Ionicons name="options-outline" size={16} color={P.textPrimary} />
        {isFiltersActive(filters) && <View style={styles.filterActiveBadge} />}
      </Pressable>

      {__DEV__ && (
        <Pressable
          style={[styles.dayFilterIconBtn, sampleMode && styles.daySegmentChipActive]}
          onPress={() => { const next = !sampleMode; setSampleMode(next); setDaySampleMode(next); }}
        >
          <Ionicons name="flask-outline" size={16} color={sampleMode ? P.background : P.textPrimary} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <OwnerScreenHeader
        title={t('calendar:screen.title')}
        onCreatePress={mode === 'agenda' ? () => openSlotMenu(roundToNext15(new Date()), null) : openWalkInGeneric}
        onNotificationsPress={() => router.push('/owner-notifications' as never)}
      />

      {bookingForCustomer && (
        <View style={styles.bookingForBanner}>
          <Text style={styles.bookingForText} numberOfLines={1}>
            <Trans
              ns="calendar"
              i18nKey="screen.bookingForBanner"
              values={{ name: bookingForCustomer.name }}
              components={{ bold: <Text style={styles.bookingForName} /> }}
            />
          </Text>
          <Pressable onPress={() => setBookingForCustomer(null)} hitSlop={8}>
            <Text style={styles.bookingForClear}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Fresha-parity pass — the old "← Yesterday | date | Tomorrow →" text
          row was removed in favor of just the date + a chevron opening the
          scrollable multi-month picker, with swipe-the-grid as the actual
          day-to-day navigation gesture (shiftDay/shiftView, unchanged,
          still power every onSwipeDate callback passed into the grid
          views). Restored per explicit request as a supplement, not a
          revert -- swipe nav and the dropdown both stay exactly as they
          were; these two arrows are a third, quicker way to page by
          whatever shiftView's own step size is for the active mode (a day,
          a week, or a month), for anyone who'd rather tap than swipe. */}
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar:screen.previousPeriod')}
          hitSlop={10}
          style={styles.dateNavButton}
          onPress={() => shiftView(-1)}
        >
          <Ionicons name="chevron-back" size={20} color={P.textSecondary} />
        </Pressable>
        <Pressable style={styles.dateLabelGroup} onPress={() => setDatePickerOpen(true)}>
          <Text style={styles.dateLabel}>
            {mode === 'month'
              ? formatMonthYearLong(date)
              : mode === 'week'
              ? t('calendar:screen.weekOf', { date: formatMonthDay(date) })
              : isToday ? t('calendar:screen.today') : zonedHeaderLabels(date, timeZone).dateLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={P.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('calendar:screen.nextPeriod')}
          hitSlop={10}
          style={styles.dateNavButton}
          onPress={() => shiftView(1)}
        >
          <Ionicons name="chevron-forward" size={20} color={P.textSecondary} />
        </Pressable>
      </View>
      <FreshaDatePicker
        visible={datePickerOpen}
        selectedDate={date}
        onSelect={setDate}
        onClose={() => setDatePickerOpen(false)}
      />

      {/* Mode switcher, interval picker, and staff filter all share one
          horizontally-scrollable row -- previously up to 3 stacked rows,
          which ate too much vertical space above the actual grid.
          3-Day mode wraps this row in a glass panel (Option B) instead of
          leaving it directly on the animated background (Option A, used
          everywhere else) -- a live side-by-side comparison of the two
          chrome treatments while the grid itself stays opaque either way. */}
      {mode === 'agenda' && dayControlBar}
      {mode === '3day' && (
        <View style={styles.chromeGlassWrap}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <CardOverlay />
          {chipRow}
        </View>
      )}
      {mode !== '3day' && mode !== 'agenda' && chipRow}

      {businessError ? (
        <ErrorState message={`Couldn't load your business settings: ${businessError}`} onRetry={loadBusiness} />
      ) : loading || !business || !schedule ? (
        <View style={styles.centered}><BreathingHeart size={40} color={P.accentGold} /></View>
      ) : mode === 'queue' ? (
        <QueueFlowView
          bookings={visibleBookings}
          onOpen={openBooking}
          onReadyForCheckout={openForCheckout}
          onChanged={reload}
          onAddWalkIn={() => openWalkInGeneric('walkIn')}
        />
      ) : mode === 'agenda' ? (
        // Option A: the grid sits on a fully opaque panel, so the animated
        // background only shows in the margins/chrome above -- the working
        // area (gridlines, tiny drag targets, avatar chips) reads exactly
        // as legibly as before instead of the background bleeding through
        // every empty cell.
        <View style={{ flex: 1 }}>
          <View style={styles.opaqueGridPanel}>
            <TimelineCalendar
              date={date}
              bookings={visibleBookings}
              staff={staff}
              selectedStaffId={selectedStaffId}
              weekSchedule={business.week_schedule}
              timeZone={timeZone}
              onOpenBooking={handleOpenBookingDay}
              onChanged={reload}
              onFillSlot={openSlotMenu}
              intervalMinutes={gridInterval}
              onIntervalChange={handleSetGridInterval}
              onSwipeDate={(direction) => shiftDay(direction === 'next' ? 1 : -1)}
              onOpenAnother={openWalkInFor}
              onGoToToday={() => setDate(new Date())}
            />
          </View>
          {/* Calendar 2.0 Day View Part 28/29 — Find Opening is deliberately
              left out: no real availability-search endpoint exists to back
              it (confirmed: no such route in booking-app), and the spec is
              explicit that a decorative no-op is worse than a missing
              button. The other three are all real, already-wired actions. */}
          <View style={styles.quickActionRow}>
            <QuickActionCard icon="add-circle-outline" label={t('calendar:screen.quickAdd')} sub={t('calendar:screen.quickAddSub')}
              onPress={() => openSlotMenu(roundToNext15(new Date()), null)} />
            <QuickActionCard icon="ban-outline" label={t('calendar:blockTime.title')} sub={t('calendar:screen.blockTimeSub')}
              onPress={() => openBlockTimeFor(roundToNext15(new Date()), null)} />
            <QuickActionCard icon="person-add-outline" label={t('calendar:screen.walkIn')} sub={t('calendar:screen.walkInSub')}
              onPress={() => openWalkInGeneric('walkIn')} />
          </View>
        </View>
      ) : mode === 'month' ? (
        <MonthView
          month={date}
          weekSchedule={business.week_schedule}
          filters={filters}
          onOpenBooking={openBooking}
          onViewFullDay={handleViewFullDay}
          onSwipeDate={(direction) => shiftView(direction === 'next' ? 1 : -1)}
        />
      ) : mode === '3day' ? (
        // Option B: same opaque grid panel as Today, but the chrome row
        // above got the glass treatment instead (see the merged chip row).
        <View style={styles.opaqueGridPanel}>
          <MultiDayView
            startDate={date}
            numDays={3}
            weekSchedule={business.week_schedule}
            selectedStaffId={selectedStaffId}
            filters={filters}
            onOpen={openBooking}
            onFillSlot={handleFillSlotOnDate}
            onViewFullDay={handleViewFullDay}
            intervalMinutes={gridInterval}
            onSwipeDate={(direction) => shiftView(direction === 'next' ? 1 : -1)}
          />
        </View>
      ) : (
        <MultiDayView
          startDate={date}
          numDays={7}
          weekSchedule={business.week_schedule}
          selectedStaffId={selectedStaffId}
          filters={filters}
          onOpen={openBooking}
          onFillSlot={handleFillSlotOnDate}
          onViewFullDay={handleViewFullDay}
          intervalMinutes={gridInterval}
          onSwipeDate={(direction) => shiftView(direction === 'next' ? 1 : -1)}
        />
      )}

      <AppointmentSheet
        ref={sheetRef}
        booking={selectedBooking}
        onChanged={handleChanged}
        onReadyForCheckout={handleReadyForCheckout}
        flowMode={business?.checkin_flow_mode ?? 'full'}
        onOpenDetail={(b) => { sheetRef.current?.dismiss(); router.push(`/appointment/${b.id}` as never); }}
      />
      <CheckoutSheet ref={checkoutRef} booking={selectedBooking} onDone={handleCheckoutDone} staff={staff} />
      <WalkInSheet
        ref={walkInRef}
        staff={staff}
        todaysBookings={bookings}
        onBooked={handleWalkInBooked}
        initialTime={walkInPrefill?.startsAt ?? null}
        initialStaffId={walkInPrefill?.staffId}
        outsideBusinessHours={walkInPrefill?.outsideHours}
        mode={walkInFlowMode}
        initialCustomer={bookingForCustomer}
      />

      {/* Calendar 2.0 Day View Parts 4/16 — the empty-slot / "+" menu. */}
      <Modal visible={slotMenuOpen} transparent animationType="fade" onRequestClose={() => setSlotMenuOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setSlotMenuOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{t('calendar:screen.add')}</Text>
            <PickerRow label={t('calendar:screen.newAppointment')} active={false} onPress={() => {
              setSlotMenuOpen(false);
              if (slotMenu) openWalkInFor(slotMenu.startsAt, slotMenu.staffId, slotMenu.outsideHours, 'new');
            }} />
            <PickerRow label={t('calendar:screen.walkIn')} active={false} onPress={() => {
              setSlotMenuOpen(false);
              if (slotMenu) openWalkInFor(slotMenu.startsAt, slotMenu.staffId, slotMenu.outsideHours, 'walkIn');
            }} />
            <PickerRow label={t('calendar:screen.blockTimeMenuItem')} active={false} onPress={() => {
              setSlotMenuOpen(false);
              if (slotMenu) openBlockTimeFor(slotMenu.startsAt, slotMenu.staffId);
            }} />
          </View>
        </Pressable>
      </Modal>

      {/* Calendar 2.0 Day View Part 15/2/6 — Block Time editor. Owner-only
          reason/note (internal_notes, existing column, no new data model),
          never shown to customers -- the booking simply reads as
          unavailable everywhere else, exactly like every other occupied
          slot (confirmed by code inspection: both public availability
          routes filter only on status != 'cancelled', with no branch that
          ever surfaces internal_notes to a customer-facing response). */}
      <Modal visible={blockSheetOpen} transparent animationType="fade" onRequestClose={() => setBlockSheetOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setBlockSheetOpen(false)}>
          <Pressable style={styles.blockEditorCard} onPress={(e) => e.stopPropagation()}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.pickerTitle}>{t('calendar:blockTime.title')}</Text>
              <Text style={styles.blockSubtext}>{t('calendar:screen.customersWillSeeUnavailable')}</Text>

              <Text style={styles.legendGroupLabel}>{t('calendar:screen.dateLabel')}</Text>
              <Pressable style={styles.blockFieldRow} onPress={() => setBlockDatePickerOpen(true)}>
                <Text style={styles.blockFieldValue}>
                  {formatWeekdayMonthDayYearInTZ(blockDate, timeZone)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={P.textSecondary} />
              </Pressable>

              {blockBounds.kind === 'closed' && (
                <View style={styles.blockUnavailableBanner}>
                  <Ionicons name="moon-outline" size={16} color={P.textSecondary} />
                  <Text style={styles.blockUnavailableText}>{t('calendar:screen.salonClosedOnDate')}</Text>
                </View>
              )}
              {blockBounds.kind === 'staffUnavailable' && (
                <View style={styles.blockUnavailableBanner}>
                  <Ionicons name="alert-circle-outline" size={16} color={P.textSecondary} />
                  <Text style={styles.blockUnavailableText}>{t('calendar:screen.staffNotScheduled', { staffName: blockBounds.staffName })}</Text>
                </View>
              )}
              {blockBounds.kind === 'open' && (
                <>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legendGroupLabel}>{t('calendar:screen.from')}</Text>
                      <Pressable style={styles.blockFieldRow} onPress={() => setBlockTimeFieldOpen('from')}>
                        <Text style={styles.blockFieldValue}>
                          {formatTimeShortInTZ(blockFrom, timeZone)}
                        </Text>
                      </Pressable>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.legendGroupLabel}>{t('calendar:screen.to')}</Text>
                      <Pressable style={styles.blockFieldRow} onPress={() => setBlockTimeFieldOpen('to')}>
                        <Text style={styles.blockFieldValue}>
                          {formatTimeShortInTZ(blockTo, timeZone)}
                        </Text>
                      </Pressable>
                    </View>
                  </View>

                  <Text style={styles.legendGroupLabel}>
                    {t('calendar:screen.quickDuration', { minutes: Math.max(0, Math.round((blockTo.getTime() - blockFrom.getTime()) / 60000)) })}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {([15, 30, 45, 60, 90] as const).map(mins => {
                      const active = Math.round((blockTo.getTime() - blockFrom.getTime()) / 60000) === mins;
                      return (
                        <Pressable key={mins} style={[styles.dayControlPill, active && styles.daySegmentChipActive]} onPress={() => {
                          const endMin = blockBounds.kind === 'open' ? blockBounds.endMin : Infinity;
                          const base = new Date(blockDate); base.setHours(0, 0, 0, 0);
                          const cappedEnd = Math.min(minutesOfDay(blockFrom) + mins, endMin);
                          setBlockTo(new Date(base.getTime() + cappedEnd * 60000));
                        }}>
                          <Text style={[styles.dayControlPillText, active && styles.daySegmentChipTextActive]}>{mins}m</Text>
                        </Pressable>
                      );
                    })}
                    {(() => {
                      const isPreset = [15, 30, 45, 60, 90].includes(Math.round((blockTo.getTime() - blockFrom.getTime()) / 60000));
                      return (
                        <Pressable style={[styles.dayControlPill, !isPreset && styles.daySegmentChipActive]} onPress={() => setBlockTimeFieldOpen('to')}>
                          <Text style={[styles.dayControlPillText, !isPreset && styles.daySegmentChipTextActive]}>{t('calendar:screen.custom')}</Text>
                        </Pressable>
                      );
                    })()}
                  </View>
                </>
              )}

              {/* Part 15's staff scope — "Any Staff" here means the same
                  thing the block route's own null staff_id already means
                  server-side: unassigned-to-everyone, which the existing
                  bookingStaffScopesConflict() treats as conflicting with
                  every staff member's schedule -- i.e. it blocks the whole
                  business, not "nobody." A specific staff member blocks
                  only that person. Confirmed against the block route
                  before labeling this, not assumed. */}
              <Text style={styles.legendGroupLabel}>{t('calendar:screen.staff')}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <Pressable style={[styles.dayControlPill, blockStaffId === 'any' && styles.daySegmentChipActive]} onPress={() => {
                  setBlockStaffId('any');
                  const { from, to } = clampBlockTimesToBounds(blockDate, 'any', blockFrom, blockTo);
                  setBlockFrom(from); setBlockTo(to);
                }}>
                  <Text style={[styles.dayControlPillText, blockStaffId === 'any' && styles.daySegmentChipTextActive]}>{t('calendar:screen.entireBusiness')}</Text>
                </Pressable>
                {staff.map(s => (
                  <Pressable key={s.id} style={[styles.dayControlPill, blockStaffId === s.id && styles.daySegmentChipActive]} onPress={() => {
                    setBlockStaffId(s.id);
                    const { from, to } = clampBlockTimesToBounds(blockDate, s.id, blockFrom, blockTo);
                    setBlockFrom(from); setBlockTo(to);
                  }}>
                    <Text style={[styles.dayControlPillText, blockStaffId === s.id && styles.daySegmentChipTextActive]}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>

              {/* NOTE (L5B Section N, revisited L10 Section U): BLOCK_REASON_PRESETS
                  canonical values are stored directly as bookings.internal_notes and
                  round-trip-matched via BLOCK_REASON_PRESETS.includes(notes) above --
                  the same DB-value-as-display-label risk as the owner-signup
                  business-type selector (L3). The stored value stays the fixed English
                  canonical string; only the displayed pill text is translated via
                  reasonOptions. */}
              <Text style={styles.legendGroupLabel}>{t('calendar:screen.reasonLabel')}</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {BLOCK_REASON_PRESETS.map(reason => (
                  <Pressable key={reason} style={[styles.dayControlPill, blockReason === reason && styles.daySegmentChipActive]} onPress={() => setBlockReason(reason)}>
                    <Text style={[styles.dayControlPillText, blockReason === reason && styles.daySegmentChipTextActive]}>{REASON_LABELS[reason]}</Text>
                  </Pressable>
                ))}
              </View>
              {blockReason === 'Other' && (
                <TextInput
                  style={styles.blockNoteInput}
                  placeholder={t('calendar:screen.optionalNotePlaceholder')}
                  placeholderTextColor={P.textDisabled}
                  value={blockNote}
                  onChangeText={setBlockNote}
                  maxLength={200}
                />
              )}

              <Pressable
                style={[styles.blockSubmitBtn, blockBounds.kind !== 'open' && styles.blockSubmitBtnDisabled]}
                onPress={() => submitBlockTime()}
                disabled={blockSaving || blockDeleting || blockBounds.kind !== 'open'}
              >
                <Text style={styles.blockSubmitText}>
                  {blockSaving ? (blockEditingId ? t('calendar:screen.saving') : t('calendar:screen.blocking')) : blockEditingId ? t('calendar:screen.saveChanges') : t('calendar:blockTime.title')}
                </Text>
              </Pressable>
              {blockEditingId && (
                <Pressable
                  style={styles.blockDeleteBtn}
                  disabled={blockSaving || blockDeleting}
                  onPress={() => Alert.alert(t('calendar:screen.deleteBlockConfirmTitle'), t('calendar:screen.deleteBlockConfirmMessage'), [
                    { text: t('calendar:screen.cancel'), style: 'cancel' },
                    { text: t('calendar:screen.delete'), style: 'destructive', onPress: deleteBlockTime },
                  ])}
                >
                  <Text style={styles.blockDeleteText}>{blockDeleting ? t('calendar:screen.deleting') : t('calendar:screen.deleteBlock')}</Text>
                </Pressable>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Block Time's own Date field -- reuses the existing in-house
          CalendarDatePicker (no new date-picker dependency), same
          component already used by owner-settings/time-off.tsx. */}
      <Modal visible={blockDatePickerOpen} transparent animationType="fade" onRequestClose={() => setBlockDatePickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setBlockDatePickerOpen(false)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>{t('calendar:screen.blockTimeDateTitle')}</Text>
            <CalendarDatePicker
              value={`${blockDate.getFullYear()}-${String(blockDate.getMonth() + 1).padStart(2, '0')}-${String(blockDate.getDate()).padStart(2, '0')}`}
              onChange={(d) => {
                const [y, m, day] = d.split('-').map(Number);
                const next = new Date(y, m - 1, day);
                const { from, to } = clampBlockTimesToBounds(next, blockStaffId, withDate(blockFrom, next), withDate(blockTo, next));
                setBlockDate(next);
                setBlockFrom(from);
                setBlockTo(to);
                setBlockDatePickerOpen(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Block Time's From/To fields -- a plain scrollable time list, same
          Modal+PickerRow pattern as Staff/Interval above (no time-picker
          dependency exists in this project either). */}
      <Modal visible={blockTimeFieldOpen !== null} transparent animationType="fade" onRequestClose={() => setBlockTimeFieldOpen(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setBlockTimeFieldOpen(null)}>
          <Pressable style={styles.pickerCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.pickerTitle}>{blockTimeFieldOpen === 'from' ? t('calendar:screen.startTime') : t('calendar:screen.endTime')}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {(blockBounds.kind === 'open' ? (
                blockTimeFieldOpen === 'from'
                  ? timeOptionsInRange(blockDate, blockBounds.startMin, blockBounds.endMin - 15)
                  : timeOptionsInRange(blockDate, minutesOfDay(blockFrom) + 15, blockBounds.endMin)
              ) : []).map((timeOpt) => {
                const active = blockTimeFieldOpen === 'from' ? timeOpt.getTime() === blockFrom.getTime() : timeOpt.getTime() === blockTo.getTime();
                return (
                  <PickerRow
                    key={timeOpt.getTime()}
                    label={formatTimeShortInTZ(timeOpt, timeZone)}
                    active={active}
                    onPress={() => {
                      if (blockTimeFieldOpen === 'from') {
                        // Changing From preserves the current duration where
                        // reasonable (Part 4's own wording), never less than
                        // 15 minutes.
                        const duration = Math.max(15 * 60000, blockTo.getTime() - blockFrom.getTime());
                        setBlockFrom(timeOpt);
                        setBlockTo(new Date(timeOpt.getTime() + duration));
                      } else {
                        if (timeOpt.getTime() <= blockFrom.getTime()) {
                          Alert.alert(t('calendar:screen.invalidTimeRangeTitle'), t('calendar:screen.invalidTimeRangeMessage'));
                          return;
                        }
                        setBlockTo(timeOpt);
                      }
                      setBlockTimeFieldOpen(null);
                    }}
                  />
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Calendar 2.0 Day View — Part 8's "All Staff" control and Part 6's
          interval control, as real tap-to-open pickers (not an always-open
          chip row) so the control bar reads as 4 distinct controls, matching
          the reference. Plain react-native Modal -- no new dependency, and
          avoids nesting another gesture-heavy sheet under TimelineCalendar's
          own pan/pinch/scroll gestures. */}
      <Modal visible={staffPickerOpen} transparent animationType="fade" onRequestClose={() => setStaffPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setStaffPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{t('calendar:screen.staffPickerTitle')}</Text>
            <PickerRow label={t('calendar:screen.allStaff')} active={selectedStaffId === 'all'} onPress={() => { handleSetSelectedStaffId('all'); setStaffPickerOpen(false); }} />
            {staff.map(s => (
              <PickerRow key={s.id} label={s.name} active={selectedStaffId === s.id} onPress={() => { handleSetSelectedStaffId(s.id); setStaffPickerOpen(false); }} />
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={intervalPickerOpen} transparent animationType="fade" onRequestClose={() => setIntervalPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setIntervalPickerOpen(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{t('calendar:screen.gridIntervalTitle')}</Text>
            {([15, 30, 60] as const).map(mins => (
              <PickerRow
                key={mins} label={mins === 60 ? t('calendar:screen.oneHour') : t('calendar:screen.minutes', { count: mins })} active={gridInterval === mins}
                onPress={() => { handleSetGridInterval(mins); setIntervalPickerOpen(false); }}
              />
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Calendar 2.0 Day View — Part 2's original Legend, now doubling as a
          real interactive filter sheet (audit §08) -- the same color/icon
          tokens, but each row is now checkable and actually narrows what
          the grid/queue/month card show, instead of only explaining what
          the colors mean. */}
      <Modal visible={filterSheetOpen} transparent animationType="fade" onRequestClose={() => setFilterSheetOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setFilterSheetOpen(false)}>
          <Pressable style={styles.legendCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.filterHeaderRow}>
              <Text style={styles.pickerTitle}>{t('calendar:screen.filtersTitle')}</Text>
              {isFiltersActive(filters) && (
                <Pressable onPress={clearFilters} hitSlop={8}>
                  <Text style={styles.filterClearText}>{t('calendar:screen.clearFilters')} ({activeFilterCount(filters)})</Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.legendGroupLabel}>{t('calendar:screen.statusGroup')}</Text>
              {ALL_STATUS_KEYS.map(key => (
                <FilterDot
                  key={key}
                  color={STATUS_COLOR[key]}
                  label={statusLabel(key)}
                  active={filters.statuses.has(key)}
                  onPress={() => toggleFilter('statuses', key)}
                />
              ))}

              <Text style={styles.legendGroupLabel}>{t('calendar:screen.bookingSourceGroup')}</Text>
              {([
                ['sanaa', P.sourceSanaa, t('calendar:screen.sanaaVoiceAi')],
                ['online', P.sourceOnline, t('calendar:screen.onlineBooking')],
                ['walk_in', P.sourceWalkIn, t('calendar:screen.walkInLegend')],
                ['manual', P.sourceManual, t('calendar:screen.manual')],
                ['block', P.sourceBlock, t('calendar:screen.blockedTime')],
              ] as [BookingSource, string, string][]).map(([key, color, label]) => (
                <FilterDot
                  key={key}
                  color={color}
                  label={label}
                  active={filters.channels.has(key)}
                  onPress={() => toggleFilter('channels', key)}
                />
              ))}

              <Text style={styles.legendGroupLabel}>{t('calendar:screen.paymentGroup')}</Text>
              {([
                ['paid', PAYMENT_COLOR.paid, t('calendar:screen.paid')],
                ['unpaid', PAYMENT_COLOR.unpaid, t('calendar:screen.unpaid')],
                ['deposit', PAYMENT_COLOR.deposit, t('calendar:screen.deposit')],
              ] as [Exclude<PaymentBadge, null>, string, string][]).map(([key, color, label]) => (
                <FilterDot
                  key={key}
                  color={color}
                  label={label}
                  active={filters.payment.has(key)}
                  onPress={() => toggleFilter('payment', key)}
                />
              ))}

              {services.length > 0 && (
                <>
                  <Text style={styles.legendGroupLabel}>{t('calendar:screen.servicesGroup')}</Text>
                  {services.map(s => (
                    <FilterDot
                      key={s.id}
                      color={P.textDisabled}
                      label={s.name}
                      active={filters.serviceIds.has(s.id)}
                      onPress={() => toggleFilter('serviceIds', s.id)}
                    />
                  ))}
                </>
              )}
            </ScrollView>

            <Text style={styles.legendFooter}>{t('calendar:screen.allTimesShownIn', { timeZone })}</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function PickerRow({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.pickerRow} onPress={onPress}>
      <Text style={[styles.pickerRowText, active && styles.pickerRowTextActive]}>{label}</Text>
      {active && <Ionicons name="checkmark" size={16} color={P.accentGold} />}
    </Pressable>
  );
}

function FilterDot({ color, label, active, onPress }: { color: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.legendRow} onPress={onPress}>
      <View style={[styles.filterCheckbox, active && styles.filterCheckboxActive]}>
        {active && <Ionicons name="checkmark" size={12} color={P.background} />}
      </View>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[styles.legendLabel, active && styles.legendLabelActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function QuickActionCard({ icon, label, sub, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; sub: string; onPress: () => void }) {
  return (
    <Pressable style={styles.quickActionCard} onPress={onPress}>
      <Ionicons name={icon} size={18} color={P.accentGold} />
      <Text style={styles.quickActionLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.quickActionSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
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

  // ── Day View control bar (Calendar 2.0 Parts 2/9/30) ──────────────────
  dayControlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
  },
  dayControlPill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
    borderRadius: BorderRadius.full, paddingHorizontal: 7, paddingVertical: 7,
  },
  dayControlPillText: { fontSize: 11, fontWeight: '600', color: P.textPrimary },
  daySegmentGroup: {
    flex: 1, flexDirection: 'row', backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
    borderRadius: BorderRadius.full, padding: 2, gap: 1, minWidth: 0,
  },
  daySegmentChip: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderRadius: BorderRadius.full, minWidth: 0 },
  daySegmentChipActive: { backgroundColor: P.darkGold },
  daySegmentChipText: { fontSize: 9.5, fontWeight: '700', color: P.textSecondary },
  daySegmentChipTextActive: { color: P.background },
  dayFilterIconBtn: {
    width: 32, height: 32, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
  },
  filterActiveBadge: {
    position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: P.accentGold,
  },

  // ── Quick Action row (Day View Parts 28/29) ─────────────────────────────
  quickActionRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    backgroundColor: P.background,
  },
  quickActionCard: {
    flex: 1, backgroundColor: P.surface, borderWidth: 1, borderColor: P.border,
    borderRadius: BorderRadius.lg, padding: 10, gap: 2, minWidth: 0,
  },
  quickActionLabel: { fontSize: 12, fontWeight: '700', color: P.textPrimary, marginTop: 4 },
  quickActionSub: { fontSize: 10, color: P.textSecondary },

  // ── Picker modals (staff / interval) ───────────────────────────────────
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  pickerCard: {
    minWidth: 220, maxWidth: '80%', backgroundColor: P.surface, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: P.border, padding: Spacing.md,
  },
  pickerTitle: { fontSize: 13, fontWeight: '800', color: P.textSecondary, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 4,
  },
  pickerRowText: { fontSize: 15, color: P.textPrimary },
  pickerRowTextActive: { color: P.accentGold, fontWeight: '700' },

  // ── Filter / Legend sheet ───────────────────────────────────────────────
  legendCard: {
    width: '86%', maxWidth: 340, maxHeight: '78%', backgroundColor: P.surface, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: P.border, padding: Spacing.lg,
  },
  filterHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  filterClearText: { fontSize: 12, fontWeight: '700', color: P.accentGold },
  legendGroupLabel: { fontSize: 11, fontWeight: '800', color: P.textDisabled, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  filterCheckbox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: P.border,
    alignItems: 'center', justifyContent: 'center',
  },
  filterCheckboxActive: { backgroundColor: P.accentGold, borderColor: P.accentGold },
  legendSwatch: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { fontSize: 13, color: P.textPrimary, flex: 1 },
  legendLabelActive: { color: P.accentGold, fontWeight: '700' },
  legendFooter: { fontSize: 11.5, color: P.textSecondary, marginTop: 14, textAlign: 'center' },
  blockSubmitBtn: {
    marginTop: 16, backgroundColor: P.accentGold, borderRadius: BorderRadius.full,
    paddingVertical: 12, alignItems: 'center',
  },
  blockSubmitBtnDisabled: { opacity: 0.4 },
  blockSubmitText: { fontSize: 14, fontWeight: '800', color: P.background },
  blockUnavailableBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: P.card,
    borderWidth: 1, borderColor: P.border, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 12, marginTop: 4,
  },
  blockUnavailableText: { fontSize: 13, color: P.textSecondary, flex: 1 },
  blockEditorCard: {
    width: '90%', maxWidth: 380, maxHeight: '86%', backgroundColor: P.surface, borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: P.border, padding: Spacing.lg,
  },
  blockSubtext: { fontSize: 12, color: P.textSecondary, marginTop: 2, marginBottom: 4 },
  blockFieldRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: P.card, borderWidth: 1, borderColor: P.border, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  blockFieldValue: { fontSize: 14, fontWeight: '700', color: P.textPrimary },
  blockNoteInput: {
    marginTop: 8, backgroundColor: P.card, borderWidth: 1, borderColor: P.border, borderRadius: BorderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: P.textPrimary,
  },
  blockDeleteBtn: { marginTop: 10, alignItems: 'center', paddingVertical: 10 },
  blockDeleteText: { fontSize: 13, fontWeight: '700', color: P.error },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
  },
  // Fixed square touch target (not just hitSlop) so the arrow's tap area
  // is consistent regardless of the chevron glyph's own tiny icon bounds.
  dateNavButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateLabelGroup: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dateNav: { fontSize: 13, color: P.accentGold, fontWeight: '600' },
  dateLabel: { fontSize: 15, fontWeight: '700', color: P.textPrimary },
  chromeGlassWrap: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: BorderRadius.xl,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
  },
  opaqueGridPanel: { flex: 1, backgroundColor: P.background },
  bookingForBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 8,
    borderRadius: BorderRadius.md, backgroundColor: 'rgba(244,215,122,0.12)', borderWidth: 1, borderColor: 'rgba(244,215,122,0.35)',
  },
  bookingForText: { flex: 1, fontSize: 12.5, color: '#F4D77A' },
  bookingForName: { fontWeight: '800' },
  bookingForClear: { fontSize: 14, color: '#F4D77A', fontWeight: '700', paddingHorizontal: 6 },
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
