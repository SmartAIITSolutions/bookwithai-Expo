import { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '@/lib/config';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface AvailabilitySlot {
  starts_at: string;
  ends_at: string;
  staff_id: string | null;
  staff_name: string;
  available: boolean;
}

function fmtTime(isoStr: string) {
  const d = new Date(isoStr);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface RebookDateTimeModalProps {
  visible: boolean;
  initialDate: Date;
  salonId: string;
  serviceId: string | null;
  staffId?: string | null;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}

// Month-grid date picker + time-slot picker, reusing the same grid layout
// MonthView.tsx already uses for the Calendar screen -- no date/time
// picker library exists anywhere in this app, so this stays consistent
// with the rest of the codebase rather than introducing one. Time slots
// come from the same GET /api/availability endpoint the customer-facing
// booking flow (booking/datetime.tsx) uses, so a rebook can never suggest
// a time that conflicts with an existing appointment or falls outside the
// assigned staff member's working hours.
export function RebookDateTimeModal({ visible, initialDate, salonId, serviceId, staffId, onCancel, onConfirm }: RebookDateTimeModalProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const selectedDateObj = new Date(selectedYear, selectedMonth, selectedDay);

  useEffect(() => {
    if (!visible || !salonId) return;
    let cancelled = false;
    setLoadingSlots(true);
    setSlotsError(null);
    setSelectedSlot(null);
    (async () => {
      try {
        const url = new URL(`${API_BASE}/api/availability`);
        url.searchParams.set('client_id', salonId);
        url.searchParams.set('date', toLocalDateStr(selectedDateObj));
        if (serviceId) url.searchParams.set('service_ids', serviceId);
        if (staffId) url.searchParams.set('staff_id', staffId);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error('Failed to load availability');
        const json = await res.json();
        if (cancelled) return;
        const available = ((json.slots ?? []) as AvailabilitySlot[]).filter(s => s.available);
        setSlots(available);
        if (available.length === 0) setSlotsError('No available slots for this date.');
      } catch {
        if (!cancelled) setSlotsError('Could not load availability. Please try another date.');
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, salonId, serviceId, staffId, selectedYear, selectedMonth, selectedDay]);

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function pickDay(day: number) {
    setSelectedDay(day);
    setSelectedYear(viewMonth.getFullYear());
    setSelectedMonth(viewMonth.getMonth());
  }

  function handleConfirm() {
    if (!selectedSlot) return;
    onConfirm(new Date(selectedSlot.starts_at));
  }

  const isSelectedMonth = viewMonth.getFullYear() === selectedYear && viewMonth.getMonth() === selectedMonth;

  const today = new Date();
  const isTodayCell = (day: number) =>
    viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth() && day === today.getDate();
  const isSuggestedCell = (day: number) =>
    viewMonth.getFullYear() === initialDate.getFullYear() && viewMonth.getMonth() === initialDate.getMonth() && day === initialDate.getDate();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <Text style={styles.title}>Pick a date & time</Text>

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color="#F4D77A" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color="#F4D77A" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map(d => <Text key={d} style={styles.weekdayLabel}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const isSelected = isSelectedMonth && day === selectedDay;
              const isToday = isTodayCell(day);
              const isSuggested = isSuggestedCell(day);
              return (
                <Pressable key={i} style={styles.cell} onPress={() => pickDay(day)}>
                  <View style={[
                    styles.dayCircle,
                    !isSelected && isSuggested && styles.dayCircleSuggested,
                    !isSelected && isToday && styles.dayCircleToday,
                    isSelected && styles.dayCircleSelected,
                  ]}>
                    <Text style={[
                      styles.dayNumber,
                      !isSelected && isSuggested && styles.dayNumberSuggested,
                      isSelected && styles.dayNumberSelected,
                    ]}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotToday]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotSuggested]} />
              <Text style={styles.legendText}>Suggested</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Time</Text>
          {loadingSlots ? (
            <View style={styles.timeStateBox}>
              <ActivityIndicator color="#F4D77A" />
            </View>
          ) : slotsError ? (
            <View style={styles.timeStateBox}>
              <Text style={styles.timeStateText}>{slotsError}</Text>
            </View>
          ) : (
            <ScrollView style={styles.timeScroll} contentContainerStyle={styles.timeGrid}>
              {slots.map((slot, i) => {
                const active = selectedSlot?.starts_at === slot.starts_at && selectedSlot?.staff_id === slot.staff_id;
                return (
                  <TouchableOpacity
                    key={`${slot.starts_at}-${slot.staff_id ?? i}`}
                    style={[styles.timeChip, active && styles.timeChipActive]}
                    onPress={() => setSelectedSlot(slot)}
                  >
                    <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{fmtTime(slot.starts_at)}</Text>
                    {!staffId && slot.staff_name ? (
                      <Text style={[styles.timeChipStaff, active && styles.timeChipStaffActive]} numberOfLines={1}>{slot.staff_name}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} disabled={!selectedSlot}>
              <Text style={[styles.confirmText, !selectedSlot && styles.confirmTextDisabled]}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)' },
  card: {
    width: '100%', maxWidth: 380, maxHeight: '85%', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: '#0B0712',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF', marginBottom: 4 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm },
  monthLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  weekdayRow: { flexDirection: 'row', marginTop: Spacing.xs },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: FontFamily.soraSemiBold, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: '#F4D77A' },
  // Real today's date -- a ring so it never gets confused with the
  // filled/selected state.
  dayCircleToday: { borderWidth: 1.5, borderColor: '#F4D77A' },
  // The date the rebook suggestion originally landed on (interval_days
  // out from the visit being checked out) -- a distinct filled tint so
  // salons can tell at a glance which day was suggested vs. what they've
  // since picked.
  dayCircleSuggested: { backgroundColor: 'rgba(154,113,255,0.35)', borderWidth: 1, borderColor: '#9A71FF' },
  dayNumber: { fontFamily: FontFamily.sora, fontSize: 13, color: '#FFFFFF' },
  dayNumberSelected: { color: '#09000F', fontFamily: FontFamily.soraSemiBold },
  dayNumberSuggested: { color: '#FFFFFF', fontFamily: FontFamily.soraSemiBold },
  legendRow: { flexDirection: 'row', gap: Spacing.md, marginTop: 2, marginBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendDotToday: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#F4D77A' },
  legendDotSuggested: { backgroundColor: '#9A71FF' },
  legendText: { fontFamily: FontFamily.sora, fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  sectionLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, color: '#F4D77A', marginTop: Spacing.xs,
  },
  timeScroll: { maxHeight: 140 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
  timeChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  timeChipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  timeChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12, color: '#FFFFFF' },
  timeChipTextActive: { color: '#09000F' },
  timeChipStaff: { fontFamily: FontFamily.sora, fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  timeChipStaffActive: { color: 'rgba(9,0,15,0.7)' },
  timeStateBox: { minHeight: 80, alignItems: 'center', justifyContent: 'center' },
  timeStateText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', paddingVertical: 8 },
  confirmText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A', paddingVertical: 8 },
  confirmTextDisabled: { color: 'rgba(212,175,55,0.3)' },
});
