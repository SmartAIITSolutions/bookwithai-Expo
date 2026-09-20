import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { getMonthSummary, MonthSummaryPreview } from '@/lib/api/ownerCalendarSummary';
import { listBookingsForDate, OwnerBooking, serviceDisplayName, customerDisplayName } from '@/lib/api/ownerBookings';
import { ownerBookingsQueryKey } from '@/lib/calendar/useOwnerBookings';
import { useAuth } from '@/lib/auth/AuthContext';
import { bookingStatusColor, isRebookNudgeBooking, REBOOK_NUDGE_COLOR } from '@/lib/calendar/bookingStatus';
import { CalendarFilters, bookingMatchesFilters } from '@/lib/calendar/bookingFilters';
import { findEmptySpaces } from '@/lib/calendar/calendarInsights';
import { WeekSchedule, dayScheduleFor, localDateKey } from '@/lib/calendar/timeGrid';
import { BreathingHeart } from '@/components/BreathingHeart';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useTranslation } from 'react-i18next';
import { formatWeekdayShort, formatWeekdayMonthDayLong, formatTimeShort } from '@/lib/i18n/format';

const PULL_THRESHOLD = 60;
const PULL_MAX = 90;

// 2023-01-01 was a real Sunday -- stable reference date so Intl can produce a
// locale-correct short weekday name for the month-grid header.
const REFERENCE_SUNDAY = new Date(2023, 0, 1);
function weekdayShortUpperForIndex(index: number): string {
  const d = new Date(REFERENCE_SUNDAY);
  d.setDate(REFERENCE_SUNDAY.getDate() + index);
  return formatWeekdayShort(d).toUpperCase();
}

interface MonthViewProps {
  month: Date; // any date within the target month
  weekSchedule: WeekSchedule | null;
  // Calendar parity pass (audit §08) — applies to the bottom summary card's
  // own booking list (it has the full OwnerBooking shape). The grid's own
  // per-day dot/preview counts come from a separate lightweight server
  // aggregate (getMonthSummary) that doesn't carry channel/service data, so
  // they intentionally stay unfiltered (whole-month totals) rather than
  // silently mismatching the card below them.
  filters?: CalendarFilters;
  onOpenBooking: (b: OwnerBooking) => void;
  onViewFullDay: (d: Date) => void; // tapping a day cell -> switches to Day mode
  // Swiping the grid pages by a full month -- same left-to-go-forward/
  // right-to-go-back convention as Day view's own swipe.
  onSwipeDate?: (direction: 'prev' | 'next') => void;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6].map(weekdayShortUpperForIndex);

// One of Phase 0.3's six calendar modes — "for planning only, never the
// default, never used for daily operations." Tapping a day jumps straight
// into Day view for that date; the inline summary below the grid always
// reflects whichever date was tapped most recently (or today, on first
// load) as an at-a-glance preview.
export function MonthView({ month, weekSchedule, filters, onOpenBooking, onViewFullDay, onSwipeDate }: MonthViewProps) {
  const { t } = useTranslation(['calendar']);
  const { clientId } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  // Same hand-rolled pull-to-refresh as TimelineCalendar/MultiDayView --
  // this screen never scrolls at all (fixed grid + summary card), so
  // there's no scrollY to gate on: any downward drag counts as a pull.
  const pullY = useSharedValue(0);

  // Fresha never leaves Month view on a plain cell tap -- it only updates
  // which day the (kept) summary card below is showing. Full-day drill-down
  // still exists, just moved to the explicit "view full day" affordances
  // (long-press, or the summary card's own button) instead of firing on
  // every tap.
  function handleCellPress(d: Date) {
    setSelectedDate(d);
  }

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const selectedDateKey = localDateKey(selectedDate);

  // Caching pass — both of these used to bypass React Query (plain
  // useState + a fresh fetch on every mount/selectedDate change), so
  // paging months or re-selecting a day already viewed this session always
  // re-fetched from scratch. The day query reuses Day view's own per-date
  // key (ownerBookingsQueryKey) -- selecting a day already cached by Day
  // view, or by this same card a moment ago, renders instantly.
  const monthQuery = useQuery({
    queryKey: ['owner-month-summary', clientId, monthKey],
    queryFn: async () => {
      const r = await getMonthSummary(monthKey);
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
    enabled: !!clientId,
  });
  const counts = monthQuery.data?.counts ?? {};
  const previews = monthQuery.data?.previews ?? {};

  const dayQuery = useQuery({
    queryKey: ownerBookingsQueryKey(clientId, selectedDateKey),
    queryFn: async () => {
      const r = await listBookingsForDate(selectedDateKey);
      if (!r.ok) throw new Error(r.error);
      return r.data.data;
    },
    enabled: !!clientId,
  });
  const loadingDay = dayQuery.isLoading;
  const dayBookings = (dayQuery.data ?? []).filter(b => b.status !== 'cancelled' && (!filters || bookingMatchesFilters(b, filters)));

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([monthQuery.refetch(), dayQuery.refetch()]);
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
    // Bug fix — selectedDate (and the summary card it drives below the
    // grid) never reset when the owner navigated to a different month --
    // only tapping a cell changed it, so paging from September to October
    // left "Sunday, September 20" (whatever selectedDate happened to
    // default to on mount) showing under an October grid. Reset it to
    // today when today falls inside the newly-viewed month, else the 1st
    // of that month, same "closest sensible default" MonthView already
    // uses for empty-state days elsewhere.
    const today = new Date();
    const todayInThisMonth = today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth();
    setSelectedDate(todayInThisMonth ? today : new Date(month.getFullYear(), month.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

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
        {WEEKDAYS.map((d, i) => <Text key={i} style={styles.weekdayLabel}>{d}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const key = localDateKey(d);
          const count = counts[key] ?? 0;
          const dayPreviews = previews[key] ?? [];
          const CHIP_CAP = 2;
          const shownPreviews = dayPreviews.slice(0, CHIP_CAP);
          const overflow = count - shownPreviews.length;
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          return (
            <Pressable
              key={i}
              style={[styles.cell, isSelected && styles.cellSelected]}
              onPress={() => handleCellPress(d)}
              onLongPress={() => onViewFullDay(d)}
            >
              <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                <Text style={[styles.dayNumber, isToday && !isSelected && styles.dayNumberToday, isSelected && styles.dayNumberSelected]}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={styles.chipStack}>
                {shownPreviews.map((b, bi) => {
                  const { color } = bookingStatusColor(b);
                  return (
                    <View key={bi} style={[styles.chip, { backgroundColor: color + '26', borderColor: color }]}>
                      <Text style={[styles.chipText, { color }]} numberOfLines={1}>
                        {formatTimeShort(new Date(b.starts_at))}
                      </Text>
                    </View>
                  );
                })}
                {overflow > 0 && <Text style={styles.chipMore}>+{overflow}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryDate}>
          {formatWeekdayMonthDayLong(selectedDate)}
        </Text>
        <Text style={styles.summaryMeta}>
          {t('calendar:monthView.appointments', { count: sortedBookings.length })}
          {gaps.length > 0 ? `  ·  ${t('calendar:monthView.openSlots', { count: gaps.length })}` : ''}
        </Text>

        {sortedBookings.slice(0, 2).map((b) => {
          const { color: statusColor, label } = bookingStatusColor(b);
          const color = isRebookNudgeBooking(b) ? REBOOK_NUDGE_COLOR : statusColor;
          return (
            <Pressable key={b.id} style={styles.summaryRow} onPress={() => onOpenBooking(b)}>
              <Text style={styles.summaryTime}>
                {formatTimeShort(new Date(b.starts_at))}
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
          <Text style={styles.emptyHint}>{t('calendar:monthView.nothingOnBooks')}</Text>
        )}

        {(sortedBookings.length > 2 || gaps.length > 0) && (
          <Pressable style={styles.viewDayBtn} onPress={() => onViewFullDay(selectedDate)}>
            <Text style={styles.viewDayBtnText}>
              {gaps.length > 0
                ? t('calendar:monthView.openSlotsTapToView', { count: gaps.length })
                : t('calendar:monthView.viewFullDay')}
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
  cell: {
    width: `${100 / 7}%`, minHeight: 72, alignItems: 'center',
    paddingTop: 4, paddingBottom: 4, paddingHorizontal: 2, borderRadius: BorderRadius.sm,
  },
  cellSelected: { backgroundColor: 'rgba(255,200,87,0.08)' },
  dayCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: P.accentGold },
  dayNumber: { fontSize: 12.5, color: P.textPrimary },
  dayNumberToday: { color: P.accentGold, fontWeight: '800' },
  dayNumberSelected: { color: P.background, fontWeight: '800' },
  chipStack: { width: '100%', alignItems: 'center', gap: 2, marginTop: 3 },
  chip: { alignSelf: 'stretch', borderRadius: BorderRadius.sm, borderWidth: 1, paddingVertical: 1, paddingHorizontal: 3 },
  chipText: { fontSize: 8.5, fontWeight: '700', textAlign: 'center' },
  chipMore: { fontSize: 8.5, fontWeight: '700', color: P.textDisabled, marginTop: 1 },

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
