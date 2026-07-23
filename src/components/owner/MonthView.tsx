import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { getMonthSummary } from '@/lib/api/ownerCalendarSummary';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces } from '@/lib/calendar/calendarInsights';
import { WeekSchedule, dayScheduleFor, localDateKey } from '@/lib/calendar/timeGrid';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

interface MonthViewProps {
  month: Date; // any date within the target month
  weekSchedule: WeekSchedule | null;
  onOpenBooking: (b: OwnerBooking) => void;
  onViewFullDay: (d: Date) => void; // "N Open Slots — tap to view" -> switches to Day mode
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// One of Phase 0.3's six calendar modes — "for planning only, never the
// default, never used for daily operations." Tapping a day selects it and
// shows an inline summary below the grid; only the summary's own
// "Open Slots — tap to view" action jumps into the full Day view.
export function MonthView({ month, weekSchedule, onOpenBooking, onViewFullDay }: MonthViewProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dayBookings, setDayBookings] = useState<OwnerBooking[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    getMonthSummary(monthKey).then(r => { if (r.ok) setCounts(r.data.counts); });
  }, [monthKey]);

  useEffect(() => {
    setLoadingDay(true);
    const key = localDateKey(selectedDate);
    listBookingsForDate(key).then(r => {
      if (r.ok) setDayBookings(r.data.data.filter(b => b.status !== 'cancelled'));
      setLoadingDay(false);
    });
  }, [selectedDate]);

  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const todayKey = localDateKey(new Date());
  const selectedKey = localDateKey(selectedDate);

  const cells: (Date | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const schedule = dayScheduleFor(weekSchedule, selectedDate);
  const gaps = loadingDay ? [] : findEmptySpaces(dayBookings, schedule, 30);
  const sortedBookings = [...dayBookings].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((d) => <Text key={d} style={styles.weekdayLabel}>{d}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const key = localDateKey(d);
          const count = counts[key] ?? 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <Pressable key={i} style={styles.cell} onPress={() => setSelectedDate(d)}>
              <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                <Text style={[styles.dayNumber, isToday && !isSelected && styles.dayNumberToday, isSelected && styles.dayNumberSelected]}>
                  {d.getDate()}
                </Text>
              </View>
              {count > 0 && <View style={styles.countDot} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryDate}>
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text style={styles.summaryMeta}>
          {sortedBookings.length} appointment{sortedBookings.length === 1 ? '' : 's'}
          {gaps.length > 0 ? `  ·  ${gaps.length} open slot${gaps.length === 1 ? '' : 's'}` : ''}
        </Text>

        {sortedBookings.slice(0, 2).map((b) => {
          const { color, label } = bookingStatusColor(b);
          return (
            <Pressable key={b.id} style={styles.summaryRow} onPress={() => onOpenBooking(b)}>
              <Text style={styles.summaryTime}>
                {new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryCustomer} numberOfLines={1}>{b.customer?.name ?? 'Customer'}</Text>
                <Text style={styles.summaryService} numberOfLines={1}>{b.service?.name ?? 'Service'}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: color + '26', borderColor: color }]}>
                <Text style={[styles.badgeText, { color }]}>{label}</Text>
              </View>
            </Pressable>
          );
        })}

        {sortedBookings.length === 0 && gaps.length === 0 && !loadingDay && (
          <Text style={styles.emptyHint}>Nothing on the books for this day.</Text>
        )}

        {(sortedBookings.length > 2 || gaps.length > 0) && (
          <Pressable style={styles.viewDayBtn} onPress={() => onViewFullDay(selectedDate)}>
            <Text style={styles.viewDayBtnText}>
              {gaps.length > 0
                ? `${gaps.length} Open Slot${gaps.length === 1 ? '' : 's'} — tap to view`
                : 'View full day →'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10.5, color: P.textDisabled, fontWeight: '700', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: P.accentGold },
  dayNumber: { fontSize: 13, color: P.textPrimary },
  dayNumberToday: { color: P.accentGold, fontWeight: '800' },
  dayNumberSelected: { color: P.background, fontWeight: '800' },
  countDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: P.highlightPurple, marginTop: 2 },

  summaryCard: {
    backgroundColor: P.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: P.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  summaryDate: { fontSize: 15, fontWeight: '700', color: P.textPrimary },
  summaryMeta: { fontSize: 12.5, color: P.textSecondary, marginBottom: Spacing.xs },
  emptyHint: { fontSize: 13, color: P.textDisabled, paddingVertical: Spacing.sm },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderTopWidth: 1, borderTopColor: P.border, paddingVertical: Spacing.sm,
  },
  summaryTime: { fontSize: 12, color: P.textSecondary, fontWeight: '600', width: 56 },
  summaryCustomer: { fontSize: 13.5, fontWeight: '700', color: P.textPrimary },
  summaryService: { fontSize: 12, color: P.textSecondary, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  viewDayBtn: {
    marginTop: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: 'dashed',
    borderColor: P.accentGold, paddingVertical: Spacing.sm, alignItems: 'center',
    backgroundColor: 'rgba(255,200,87,0.08)',
  },
  viewDayBtnText: { fontSize: 13, fontWeight: '700', color: P.accentGold },
});
