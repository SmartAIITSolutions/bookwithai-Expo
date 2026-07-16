import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

// ─── Types ───────────────────────────────────────────────────────────────────
interface TimeSlot {
  starts_at: string;
  ends_at: string;
  staff_id: string;
  staff_name: string;
  available: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toLocalDateStr(date: Date): string {
  // YYYY-MM-DD in local time
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatSlotTime(isoStr: string): string {
  const d = new Date(isoStr);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── Screen ──────────────────────────────────────────────────────────────────
export default function DateTimeScreen() {
  const {
    salonId, salonSlug, salonName, requireOnlinePayment,
    serviceIds, serviceNames, totalCents, totalMins,
    staffId, staffName,
  } = useLocalSearchParams<{
    salonId: string; salonSlug: string; salonName: string; requireOnlinePayment: string;
    serviceIds: string; serviceNames: string; totalCents: string; totalMins: string;
    staffId: string; staffName: string;
  }>();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  // Countdown hold timer (3 min = 180s)
  const [holdSeconds, setHoldSeconds] = useState<number | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  function startHold() {
    setHoldSeconds(180);
    if (holdInterval.current) clearInterval(holdInterval.current);
    holdInterval.current = setInterval(() => {
      setHoldSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(holdInterval.current!);
          setSelectedSlot(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Fetch availability when date changes
  const fetchSlots = useCallback(async (date: Date) => {
    if (!salonId) return;
    setLoadingSlots(true);
    setSlotsError(null);
    setSlots([]);
    setSelectedSlot(null);
    setHoldSeconds(null);
    if (holdInterval.current) clearInterval(holdInterval.current);

    try {
      const dateStr = toLocalDateStr(date);
      const url = new URL('https://bookwithai.app/api/availability');
      url.searchParams.set('client_id', salonId);
      url.searchParams.set('date', dateStr);

      if (serviceIds) {
        serviceIds.split(',').forEach((id) => url.searchParams.append('service_ids', id));
      }
      if (staffId) {
        url.searchParams.set('staff_id', staffId);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to load availability');
      const json = await res.json();
      const available = (json.slots as TimeSlot[]).filter((s) => s.available);
      setSlots(available);
      if (available.length === 0) setSlotsError('No available slots for this date.');
    } catch (e: any) {
      setSlotsError('Could not load availability. Please try another date.');
    } finally {
      setLoadingSlots(false);
    }
  }, [salonId, serviceIds, staffId]);

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate);
  }, [selectedDate]);

  function selectSlot(slot: TimeSlot) {
    setSelectedSlot(slot);
    startHold();
  }

  function handleContinue() {
    if (!selectedSlot || !selectedDate) return;
    if (holdInterval.current) clearInterval(holdInterval.current);
    router.push({
      pathname: '/booking/review',
      params: {
        salonId, salonSlug, salonName, requireOnlinePayment,
        serviceIds, serviceNames, totalCents, totalMins,
        staffId: selectedSlot.staff_id,
        staffName: selectedSlot.staff_name,
        startsAt: selectedSlot.starts_at,
        endsAt: selectedSlot.ends_at,
      },
    });
  }

  // ── Calendar nav ──────────────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // ── Build calendar grid ───────────────────────────────────────────────────
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const holdDisplay = holdSeconds !== null
    ? `${Math.floor(holdSeconds / 60)}:${String(holdSeconds % 60).padStart(2, '0')}`
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Date & Time</Text>
          {salonName ? <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text> : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Calendar ── */}
        <View style={styles.calCard}>
          {/* Month nav */}
          <View style={styles.calHeader}>
            <Pressable onPress={prevMonth} style={styles.calNavBtn}>
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.calMonth}>{MONTHS[viewMonth]} {viewYear}</Text>
            <Pressable onPress={nextMonth} style={styles.calNavBtn}>
              <Ionicons name="chevron-forward" size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>

          {/* Day labels */}
          <View style={styles.calDayLabels}>
            {DAYS.map((d) => (
              <Text key={d} style={styles.calDayLabel}>{d}</Text>
            ))}
          </View>

          {/* Date cells */}
          <View style={styles.calGrid}>
            {cells.map((day, idx) => {
              if (!day) return <View key={idx} style={styles.calCell} />;
              const cellDate = new Date(viewYear, viewMonth, day);
              const isPast = cellDate < today;
              const isSelected =
                selectedDate?.getDate() === day &&
                selectedDate?.getMonth() === viewMonth &&
                selectedDate?.getFullYear() === viewYear;
              const isToday =
                day === today.getDate() &&
                viewMonth === today.getMonth() &&
                viewYear === today.getFullYear();

              return (
                <Pressable
                  key={idx}
                  style={[
                    styles.calCell,
                    isSelected && styles.calCellSelected,
                    isToday && !isSelected && styles.calCellToday,
                    isPast && styles.calCellPast,
                  ]}
                  onPress={() => !isPast && setSelectedDate(cellDate)}
                  disabled={isPast}>
                  <Text style={[
                    styles.calCellText,
                    isSelected && styles.calCellTextSelected,
                    isPast && styles.calCellTextPast,
                    isToday && !isSelected && styles.calCellTextToday,
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Time Slots ── */}
        {selectedDate && (
          <View style={styles.slotsSection}>
            <Text style={styles.slotsTitle}>
              Available Times — {DAYS[selectedDate.getDay()]}, {MONTHS[selectedDate.getMonth()].slice(0, 3)} {selectedDate.getDate()}
            </Text>

            {loadingSlots ? (
              <View style={styles.slotsCentered}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : slotsError ? (
              <View style={styles.slotsCentered}>
                <Ionicons name="calendar-outline" size={36} color={Colors.textSecondary} />
                <Text style={styles.slotsEmptyText}>{slotsError}</Text>
              </View>
            ) : (
              <View style={styles.slotsGrid}>
                {slots.map((slot, i) => {
                  const sel = selectedSlot?.starts_at === slot.starts_at && selectedSlot?.staff_id === slot.staff_id;
                  return (
                    <Pressable
                      key={i}
                      style={[styles.slotChip, sel && styles.slotChipSelected]}
                      onPress={() => selectSlot(slot)}>
                      <Text style={[styles.slotTime, sel && styles.slotTimeSelected]}>
                        {formatSlotTime(slot.starts_at)}
                      </Text>
                      {!staffId && slot.staff_name ? (
                        <Text style={[styles.slotStaff, sel && styles.slotStaffSelected]} numberOfLines={1}>
                          {slot.staff_name}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Hold timer */}
        {holdDisplay && (
          <View style={styles.holdBanner}>
            <Ionicons name="time-outline" size={16} color={Colors.warning} />
            <Text style={styles.holdText}>
              Slot held for <Text style={styles.holdTimer}>{holdDisplay}</Text> — complete your booking soon
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      {selectedSlot && (
        <View style={styles.footer}>
          <View style={styles.footerInfo}>
            <Text style={styles.footerTime}>{formatSlotTime(selectedSlot.starts_at)}</Text>
            <Text style={styles.footerStaff}>with {selectedSlot.staff_name}</Text>
          </View>
          <Pressable style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>Review Booking</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.white} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const CELL_SIZE = 38;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  scrollContent: { padding: Spacing.md },

  // Calendar
  calCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calNavBtn: { padding: Spacing.sm },
  calMonth: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  calDayLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  calDayLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    width: CELL_SIZE,
    textAlign: 'center',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  calCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  calCellSelected: {
    backgroundColor: Colors.primary,
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  calCellPast: {
    opacity: 0.3,
  },
  calCellText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  calCellTextSelected: {
    color: Colors.white,
    fontFamily: FontFamily.soraSemiBold,
  },
  calCellTextPast: {
    color: Colors.textSecondary,
  },
  calCellTextToday: {
    color: Colors.primary,
    fontFamily: FontFamily.soraSemiBold,
  },

  // Slots
  slotsSection: {
    marginTop: Spacing.xl,
  },
  slotsTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  slotsCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  slotsEmptyText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  slotChip: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 90,
    alignItems: 'center',
  },
  slotChipSelected: {
    backgroundColor: '#FAF8FF',
    borderColor: Colors.primary,
  },
  slotTime: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  slotTimeSelected: {
    color: Colors.primary,
  },
  slotStaff: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  slotStaffSelected: {
    color: Colors.primary,
  },

  // Hold banner
  holdBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#FFF7ED',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  holdText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },
  holdTimer: {
    fontFamily: FontFamily.soraSemiBold,
    color: Colors.warning,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerInfo: { flex: 1 },
  footerTime: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  footerStaff: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.button,
  },
  continueBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
