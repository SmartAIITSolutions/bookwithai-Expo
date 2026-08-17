import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { getMonthSummary } from '@/lib/api/ownerCalendarSummary';
import { listBookingsForDate, OwnerBooking, serviceDisplayName, customerDisplayName } from '@/lib/api/ownerBookings';
import { bookingStatusColor, isRebookNudgeBooking, REBOOK_NUDGE_COLOR } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces } from '@/lib/calendar/calendarInsights';
import { WeekSchedule, dayScheduleFor, localDateKey } from '@/lib/calendar/timeGrid';
import { BreathingHeart } from '@/components/BreathingHeart';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

const PULL_THRESHOLD = 60;
const PULL_MAX = 90;

interface MonthViewProps {
  month: Date; // any date within the target month
  weekSchedule: WeekSchedule | null;
  onOpenBooking: (b: OwnerBooking) => void;
  onViewFullDay: (d: Date) => void; // tapping a day cell -> switches to Day mode
  // Swiping the grid pages by a full month -- same left-to-go-forward/
  // right-to-go-back convention as Day view's own swipe.
  onSwipeDate?: (direction: 'prev' | 'next') => void;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// One of Phase 0.3's six calendar modes — "for planning only, never the
// default, never used for daily operations." Tapping a day jumps straight
// into Day view for that date; the inline summary below the grid always
// reflects whichever date was tapped most recently (or today, on first
// load) as an at-a-glance preview.
export function MonthView({ month, weekSchedule, onOpenBooking, onViewFullDay, onSwipeDate }: MonthViewProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dayBookings, setDayBookings] = useState<OwnerBooking[]>([]);
  const [loadingDay, setLoadingDay] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Same hand-rolled pull-to-refresh as TimelineCalendar/MultiDayView --
  // this screen never scrolls at all (fixed grid + summary card), so
  // there's no scrollY to gate on: any downward drag counts as a pull.
  const pullY = useSharedValue(0);

  function handleCellPress(d: Date) {
    setSelectedDate(d);
    onViewFullDay(d);
  }

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  async function loadMonth() {
    const r = await getMonthSummary(monthKey);
    if (r.ok) setCounts(r.data.counts);
  }

  async function loadDay() {
    setLoadingDay(true);
    const key = localDateKey(selectedDate);
    const r = await listBookingsForDate(key);
    if (r.ok) setDayBookings(r.data.data.filter(b => b.status !== 'cancelled'));
    setLoadingDay(false);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([loadMonth(), loadDay()]);
    setRefreshing(false);
  }

  const swipeNext = Gesture.Fling().direction(Directions.LEFT).onEnd(() => {
    if (onSwipeDate) runOnJS(onSwipeDate)('next');
  });
  const swipePrev = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => {
    if (onSwipeDate) runOnJS(onSwipeDate)('prev');
  });
  const pullGesture = Gesture.Pan()
    .onUpdate((e) => {
      pullY.value = e.translationY > 0 ? Math.min(e.translationY * 0.5, PULL_MAX) : 0;
    })
    .onEnd(() => {
      if (pullY.value > PULL_THRESHOLD) {
        runOnJS(handleRefresh)();
      }
      pullY.value = withSpring(0);
    });
  const pullIndicatorStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pullY.value, [0, PULL_THRESHOLD], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(pullY.value, [0, PULL_THRESHOLD], [0.6, 1], Extrapolation.CLAMP) }],
  }));
  const swipeGesture = Gesture.Race(swipeNext, swipePrev, pullGesture);

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    loadDay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <GestureDetector gesture={swipeGesture}>
    <View style={{ flex: 1 }}>
    <Animated.View style={[styles.pullIndicator, pullIndicatorStyle]} pointerEvents="none">
      <BreathingHeart size={26} color={P.accentGold} />
    </Animated.View>
    {refreshing && (
      <View style={styles.pullIndicator} pointerEvents="none">
        <BreathingHeart size={26} color={P.accentGold} />
      </View>
    )}
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
            <Pressable key={i} style={styles.cell} onPress={() => handleCellPress(d)}>
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
          const { color: statusColor, label } = bookingStatusColor(b);
          const color = isRebookNudgeBooking(b) ? REBOOK_NUDGE_COLOR : statusColor;
          return (
            <Pressable key={b.id} style={styles.summaryRow} onPress={() => onOpenBooking(b)}>
              <Text style={styles.summaryTime}>
                {new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryCustomer} numberOfLines={1}>{customerDisplayName(b)}</Text>
                <Text style={styles.summaryService} numberOfLines={1}>{serviceDisplayName(b)}</Text>
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
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  pullIndicator: {
    position: 'absolute', top: 10, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
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
