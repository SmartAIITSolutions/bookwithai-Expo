import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, Directions, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { OwnerBooking, updateBooking, resizeBooking, checkIn, startService, completeService, serviceDisplayName, customerDisplayName } from '@/lib/api/ownerBookings';
import { StaffMember } from '@/lib/api/ownerStaff';
import { nextAction, isRebookNudgeBooking, REBOOK_NUDGE_COLOR, bookingStatusColor } from '@/lib/calendar/bookingStatus';
import {
  WeekSchedule, dayScheduleFor, hourLabels, snapMinutes,
  zonedMinutesSinceMidnight, zonedDateKey, zonedClockLabel,
} from '@/lib/calendar/timeGrid';
import { isSampleBooking } from '@/lib/calendar/sampleDayFixture';
import {
  primaryPill, cornerIcon,
  PAYMENT_COLOR, paymentLabel,
} from '@/lib/calendar/appointmentVisual';
import { SanaaMark } from '@/components/SanaaMark';
import { BreathingHeart } from '@/components/BreathingHeart';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { formatWeekdayMonthDay, formatTimeShortInTZ, formatCentsUSDWhole } from '@/lib/i18n/format';

const PULL_THRESHOLD = 60;
const PULL_MAX = 90;

// Hotfix #2 — snapMinutes() (timeGrid.ts) is a plain JS function, not a
// worklet, so calling it directly from inside a gesture's .onEnd/.onUpdate
// body throws "Tried to synchronously call a Remote Function" -- the UI
// runtime can't jump into ordinary JS code synchronously. Its actual body
// is one line of pure arithmetic (Math.round(minutes/step)*step), so a
// worklet-local copy carrying the 'worklet' directive is the correct fix,
// not a call through runOnJS (which is for JS-thread side effects, not for
// getting a number back to keep computing on the UI thread in the same
// gesture callback). JS-thread code (finishDrag/finishResize, both already
// invoked via runOnJS) keeps using the real snapMinutes import unchanged.
function snapMinutesWorklet(minutes: number, step = 5): number {
  'worklet';
  return Math.round(minutes / step) * step;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Was 44 (an earlier "overview-first" density pass), then explicitly
// reversed per direct feedback: the resulting quarter-hour slots read as
// too cramped to tap/see accurately even with the minor gridlines added
// above, and Fresha's own Day view (confirmed live) runs meaningfully
// taller per hour than that. 100 gives each 15-min slot ~25px -- a real,
// comfortable tap target -- accepting more vertical scrolling as the
// trade-off, matching Fresha's own choice of the same trade-off. Fresha-
// parity pass — pinch steps intervalMinutes directly (see the `pinch`
// gesture below) instead of scaling this baseline continuously, so there's
// no separate zoom range constant to tune anymore.
const HOUR_HEIGHT_DEFAULT = 100; // px per 60 minutes
const COLUMN_WIDTH = 160;
const TIME_GUTTER = 52;
interface Column { id: string | null; label: string }

interface TimelineCalendarProps {
  date: Date;
  bookings: OwnerBooking[];
  staff: StaffMember[];
  selectedStaffId: string | 'all';
  weekSchedule: WeekSchedule | null;
  // Calendar 2.0 Part 1 — the salon's own IANA timezone (business.
  // iana_timezone), already fetched by the Calendar screen. All date/time
  // positioning in this component reads through this instead of the
  // device's local timezone (see timeGrid.ts's zoned* helpers).
  timeZone: string;
  onOpenBooking: (b: OwnerBooking) => void;
  onChanged: () => void;
  // Tapping empty grid space books for the exact tapped time, not just
  // "earliest available now" -- staffId is the column tapped ('unassigned'
  // maps to null, a specific staff column passes its id). `outsideHours` is
  // true when the tap landed in the closed-hours fringe (or a fully closed
  // day) -- still bookable, just flagged so the caller can warn that no
  // staff may actually be scheduled then.
  onFillSlot?: (startsAt: Date, staffId: string | null, outsideHours?: boolean) => void;
  intervalMinutes?: 15 | 30 | 60;
  // Fresha-parity pass — pinch now steps intervalMinutes between 60/30/15
  // directly (pinch-in = finer, pinch-out = coarser) instead of driving a
  // separate continuous zoom factor, matching Fresha's own pinch behavior
  // (confirmed live: pinching snaps the grid density, it doesn't smoothly
  // scale). intervalMinutes stays owned by the parent (Calendar screen),
  // same as the existing 15m/30m/1h chip control -- this just gives pinch a
  // second way to drive the exact same state.
  onIntervalChange?: (mins: 15 | 30 | 60) => void;
  // Swiping the empty grid background (not an appointment block, which has
  // its own drag gesture) pages a day forward/back, same direction
  // convention as a page-turn: swipe left to go to the next day.
  onSwipeDate?: (direction: 'prev' | 'next') => void;
  // Long-press-then-release-without-dragging on an occupied block --
  // intentional double-booking (availability-override, Sprint N).
  onOpenAnother?: (startsAt: Date, staffId: string | null) => void;
}

export function TimelineCalendar({ date, bookings, staff, selectedStaffId, weekSchedule, timeZone, onOpenBooking, onChanged, onFillSlot, intervalMinutes = 60, onIntervalChange, onSwipeDate, onOpenAnother }: TimelineCalendarProps) {
  const pinchTriggered = useSharedValue(false);
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Pull-to-refresh, hand-rolled -- native <RefreshControl> doesn't fire at
  // all on this screen (confirmed live: pulling down produces zero
  // network activity) because this whole grid is already wrapped in a
  // GestureDetector for pinch-zoom and day-paging swipes, and RNGH's
  // gesture system intercepting the touch stream ahead of the native
  // ScrollView starves SwipeRefreshLayout of the raw events it needs.
  // Tracking scrollY ourselves and adding one more gesture to the same
  // Race sidesteps the conflict instead of fighting two touch systems.
  const scrollY = useSharedValue(0);
  const scrollX = useSharedValue(0);
  const pullY = useSharedValue(0);

  async function handleRefresh() {
    setRefreshing(true);
    await onChanged();
    setRefreshing(false);
  }

  const pullGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scrollY.value <= 2 && e.translationY > 0) {
        pullY.value = Math.min(e.translationY * 0.5, PULL_MAX);
      } else {
        pullY.value = 0;
      }
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

  const schedule = dayScheduleFor(weekSchedule, date);
  // Fresha-parity pass — always the full 24h scrollable range now, per
  // direct request (was previously capped at business hours + 3h padding,
  // which made a genuinely early/late booking impossible to reach by
  // scrolling at all). `schedule` still drives shading -- closed-hours
  // bands below and scheduleForColumn's per-staff shift bands -- and the
  // initial scroll-to position (further below, useEffect keyed on date/
  // intervalMinutes) still targets salon-local "now" or the schedule's own
  // opening time; only the scrollable bounds themselves changed.
  const gridStart = 0;
  const gridEnd = 24 * 60;
  // Scale height by the interval so a tick always keeps the same generous
  // tap size -- otherwise "15 min" would pack 4x as many ticks into the
  // same space, making them harder to tap precisely, not easier.
  const hourHeight = HOUR_HEIGHT_DEFAULT * (60 / intervalMinutes);
  const pxPerMinute = hourHeight / 60;
  const totalHeight = (gridEnd - gridStart) * pxPerMinute;

  // Restored side-by-side staff columns (Fresha-parity pass). Calendar 2.0
  // had deliberately collapsed this to one unified column to match an
  // earlier design reference (see git history on this block) -- that
  // reference is being explicitly overridden now in favor of matching
  // Fresha's own chair-view calendar, per direct instruction.
  //
  // One column per ACTIVE staff member when the filter is "All", plus an
  // "Unassigned" column only when at least one real (non-cancelled,
  // non-block) booking today actually has no staff_id -- so a salon with
  // every booking properly staffed never shows a pointless empty column.
  // Selecting one specific staff still renders a single column, but now
  // carries that staff's real id/name (previously the generic "All" id
  // even when filtered to one person), which is what lets per-column shift
  // shading below resolve correctly in both modes.
  //
  // Still NOT restored in this pass: drag-a-card-sideways-to-reassign-staff.
  // That's a real, separate capability (AppointmentSheet has no
  // staff-reassign control either) -- disclosed, not silently dropped.
  const columns: Column[] = useMemo(() => {
    if (selectedStaffId !== 'all') {
      const member = staff.find(s => s.id === selectedStaffId);
      return [{ id: selectedStaffId, label: member?.name ?? i18n.t('calendar:timeline.allColumn') }];
    }
    const active = staff.filter(s => s.active);
    const cols: Column[] = active.map(s => ({ id: s.id, label: s.name }));
    const hasUnassigned = bookings.some(b => !b.staff_id && b.status !== 'cancelled' && b.source !== 'time_block');
    if (hasUnassigned) cols.push({ id: null, label: i18n.t('calendar:timeline.unassignedColumn') });
    return cols.length > 0 ? cols : [{ id: 'all', label: i18n.t('calendar:timeline.allColumn') }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId, staff, bookings]);
  const columnWidth = columns.length > 1 ? COLUMN_WIDTH : Math.max(COLUMN_WIDTH, screenWidth - TIME_GUTTER);

  function columnForBooking(b: OwnerBooking): number {
    const idx = columns.findIndex(c => c.id === b.staff_id);
    if (idx !== -1) return idx;
    const unassignedIdx = columns.findIndex(c => c.id === null);
    return unassignedIdx !== -1 ? unassignedIdx : 0;
  }

  // Per-column shift shading -- a real staff column shades by THAT
  // person's own availability (day-of-week match, same day_of_week
  // convention as DAY_KEYS/date.getDay() used everywhere else in this
  // file); the synthetic "Unassigned"/"All" fallback columns, and any
  // staff member with no availability rows configured yet, fall back to
  // the salon-wide `schedule` unchanged -- identical output to before this
  // restore for every case that isn't a real, configured staff column.
  function scheduleForColumn(col: Column): { open: boolean; start: number; end: number } {
    if (typeof col.id === 'string' && col.id !== 'all') {
      const member = staff.find(s => s.id === col.id);
      const avail = member?.availability?.find(a => a.day_of_week === date.getDay());
      if (avail) {
        const [sh, sm] = avail.start_time.split(':').map(Number);
        const [eh, em] = avail.end_time.split(':').map(Number);
        return { open: avail.is_working, start: sh + sm / 60, end: eh + em / 60 };
      }
    }
    return schedule;
  }

  // Fresha-parity pass — Fresha's own "All Staff" Day view (confirmed live)
  // shows a dedicated empty state, not an empty grid, when nobody on the
  // team has ANY availability configured yet (not just "closed today" --
  // genuinely no shifts set up at all). Only applies to the "All" filter;
  // a specific staff selection with no availability rows just falls back to
  // the salon-wide schedule (scheduleForColumn's own existing behavior).
  const noScheduledStaff = selectedStaffId === 'all' && !staff.some(s => s.active && s.availability?.some(a => a.is_working));

  function stepInterval(direction: 'finer' | 'coarser') {
    if (!onIntervalChange) return;
    const order: (15 | 30 | 60)[] = [60, 30, 15];
    const idx = order.indexOf(intervalMinutes);
    if (direction === 'finer' && idx < order.length - 1) onIntervalChange(order[idx + 1]);
    else if (direction === 'coarser' && idx > 0) onIntervalChange(order[idx - 1]);
  }

  // Fresha-parity pinch — one discrete step (60->30->15 pinching in,
  // 15->30->60 pinching out) per pinch gesture, not a continuous scale.
  // pinchTriggered guards against firing more than once while the same two
  // fingers are still down; onStart resets it for the next gesture.
  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchTriggered.value = false;
    })
    .onUpdate((e) => {
      if (pinchTriggered.value) return;
      if (e.scale > 1.35) {
        pinchTriggered.value = true;
        runOnJS(stepInterval)('finer');
      } else if (e.scale < 0.7) {
        pinchTriggered.value = true;
        runOnJS(stepInterval)('coarser');
      }
    });

  // Swipe the empty grid background to page a day forward/back. Each
  // AppointmentBlock has its own GestureDetector (drag-to-reschedule), so a
  // swipe that starts on a block never reaches this one -- only swipes over
  // open grid space page the date.
  const swipeNextDay = Gesture.Fling().direction(Directions.LEFT).onEnd(() => {
    if (onSwipeDate) runOnJS(onSwipeDate)('next');
  });
  const swipePrevDay = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => {
    if (onSwipeDate) runOnJS(onSwipeDate)('prev');
  });
  // Runs alongside (not instead of) the ScrollView's own native scroll --
  // without this, RNGH would claim the touch for these gestures and block
  // ordinary vertical scrolling entirely. Confirmed on-device: before this,
  // the whole Day grid was completely unscrollable (a plain vertical drag
  // never reached the ScrollView because backgroundGesture, wrapping the
  // entire grid via the outer GestureDetector, was winning/holding the
  // touch in Race() first) -- every one of Race()'s gestures needs this,
  // not just pullGesture.
  const pullGestureWithScroll = pullGesture.simultaneousWithExternalGesture(scrollRef as never);
  const pinchWithScroll = pinch.simultaneousWithExternalGesture(scrollRef as never);
  const swipeNextDayWithScroll = swipeNextDay.simultaneousWithExternalGesture(scrollRef as never);
  const swipePrevDayWithScroll = swipePrevDay.simultaneousWithExternalGesture(scrollRef as never);

  // Hotfix — the worklet below used to build a `Date` (via `new Date(date)`,
  // capturing the `date` prop) directly on the UI thread and then hand
  // that Date to runOnJS, which crashed ("[Worklets] Cannot copy value of
  // type 'Date'") the instant this gesture was installed, since neither a
  // captured Date nor a Date passed across the JS/UI bridge can be
  // serialized. Every other gesture in this file already avoids this --
  // e.g. longPressDrag's onEnd hands finishDrag() only plain numbers
  // (e.translationY/X) and lets finishDrag build the actual Date back on
  // the JS thread. handleEmptyTap below is that same pattern: the worklet
  // computes only numbers/booleans, runOnJS crosses the bridge with those
  // primitives only, and the Date itself is constructed here, on the JS
  // thread, where `date` was already safe to close over.
  function handleEmptyTap(tappedMinutes: number, outsideHours: boolean, colIndex: number) {
    if (!onFillSlot) return;
    const dayBase = new Date(date);
    dayBase.setHours(0, 0, 0, 0);
    const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
    const colId = columns[colIndex]?.id;
    const staffId = typeof colId === 'string' && colId !== 'all' ? colId : null;
    onFillSlot(startsAt, staffId, outsideHours);
  }

  // Bug fix — tapping truly empty grid space (not a booking, not a Smart
  // Gap, not the closed-hours fringe) previously did nothing: there was no
  // tap handler at all for that area, only for the specific overlays above
  // it. e.y is relative to this GestureDetector's own view (the ScrollView's
  // un-scrolled viewport), so scrollY.value (tracked from onScroll) has to
  // be added back to get the true position within the scrolled content.
  //
  // Staff-columns restore — e.x is relative to that SAME outer view, which
  // also contains the time gutter before the horizontally-scrolling columns
  // even start, so the gutter width has to come off first; scrollX.value
  // (tracked from the horizontal ScrollView's onScroll below) adds back
  // however far that row has been scrolled. columns/columnWidth are plain
  // JS values closed over at gesture-creation time, same pattern gridStart/
  // pxPerMinute already use in this exact worklet.
  const emptyTap = Gesture.Tap()
    .onEnd((e) => {
      const contentY = e.y + scrollY.value;
      const tappedMinutes = snapMinutesWorklet(gridStart + contentY / pxPerMinute);
      const outsideHours = schedule.open === false || tappedMinutes < schedule.start * 60 || tappedMinutes >= schedule.end * 60;
      const contentX = e.x - TIME_GUTTER + scrollX.value;
      const colIndex = Math.min(columns.length - 1, Math.max(0, Math.floor(contentX / columnWidth)));
      runOnJS(handleEmptyTap)(tappedMinutes, outsideHours, colIndex);
    })
    .simultaneousWithExternalGesture(scrollRef as never);
  const backgroundGesture = Gesture.Race(pinchWithScroll, swipeNextDayWithScroll, swipePrevDayWithScroll, pullGestureWithScroll, emptyTap);

  const labels = hourLabels(gridStart, gridEnd, intervalMinutes);
  // Fresha-parity pass — quarter-hour tick marks, always rendered at 15-min
  // steps regardless of the labeled interval (confirmed live: Fresha's own
  // grid keeps faint :15/:30/:45 dividers inside every hour even when
  // zoomed out to 1h ticks, so a tap still lands on an accurate quarter-hour
  // without switching zoom first). No-op labels-wise when the interval is
  // already 15 -- `labels` itself already covers every quarter hour then.
  const minorLabels = intervalMinutes === 15 ? [] : hourLabels(gridStart, gridEnd, 15);
  const isToday = zonedDateKey(new Date(), timeZone) === zonedDateKey(date, timeZone);
  // Explicit width for the row of columns, since a horizontal ScrollView's
  // content container doesn't reliably infer it from nested content.
  const rowWidth = columns.length * columnWidth;

  // Land on the current time (today) or the day's opening time (other
  // days) instead of midnight -- with the full 24-hour grid, midnight is
  // rarely where anyone actually wants to start scrolling from. A little
  // lead-in above the target keeps some earlier context in view too.
  useEffect(() => {
    const targetMinutes = isToday ? zonedMinutesSinceMidnight(new Date().toISOString(), timeZone) : schedule.start * 60;
    const leadInMinutes = 60;
    const y = Math.max(0, (targetMinutes - leadInMinutes - gridStart) * pxPerMinute);
    scrollRef.current?.scrollTo({ y, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.toDateString(), intervalMinutes]);

  // Calendar 2.0 Part 9 — floating "Now" button appears once the owner has
  // scrolled away from the current salon-local time; tapping it re-centers.
  const [showNowButton, setShowNowButton] = useState(false);
  function handleGridScroll(y: number) {
    scrollY.value = y;
    if (!isToday) { if (showNowButton) setShowNowButton(false); return; }
    const nowMinutes = zonedMinutesSinceMidnight(new Date().toISOString(), timeZone);
    const nowY = (nowMinutes - gridStart) * pxPerMinute;
    const away = Math.abs(y - nowY) > 220;
    if (away !== showNowButton) setShowNowButton(away);
  }
  function scrollToNow() {
    const nowMinutes = zonedMinutesSinceMidnight(new Date().toISOString(), timeZone);
    const y = Math.max(0, (nowMinutes - 60 - gridStart) * pxPerMinute);
    scrollRef.current?.scrollTo({ y, animated: true });
  }

  // Everything outside business hours (midnight to opening, closing to
  // midnight) gets a flat gray band. A fully closed day (e.g. Sunday) grays
  // out the whole grid. Computed per-column now (scheduleForColumn, used
  // inside the columns.map render loop below) rather than once globally --
  // `schedule` itself (the salon-wide fallback) is still used directly there.

  if (noScheduledStaff) {
    return (
      <View style={styles.noStaffContainer}>
        <Ionicons name="people-outline" size={48} color={P.textDisabled} />
        <Text style={styles.noStaffTitle}>{i18n.t('calendar:noStaff.title')}</Text>
        <Text style={styles.noStaffSubtitle}>{i18n.t('calendar:noStaff.subtitle')}</Text>
        <View style={styles.noStaffButtonRow}>
          <Pressable style={styles.noStaffButtonOutline} onPress={() => router.push('/owner-settings/staff' as never)}>
            <Text style={styles.noStaffButtonOutlineText}>{i18n.t('calendar:noStaff.scheduledShifts')}</Text>
          </Pressable>
          <Pressable style={styles.noStaffButtonFilled} onPress={() => router.push('/owner-settings/staff' as never)}>
            <Text style={styles.noStaffButtonFilledText}>{i18n.t('calendar:noStaff.viewAllTeamMembers')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <TimelineErrorBoundary>
    <GestureDetector gesture={backgroundGesture}>
      {/* The owner tab bar floats over the bottom of the screen (absolute
          position, ~66px + safe-area inset) -- without matching bottom
          padding here, the last hour or two of the 24-hour grid (and the
          live "now" line, whenever it's evening) render underneath it,
          scrolled-to but invisible/untappable. */}
      <View style={{ flex: 1 }}>
      <Animated.View style={[styles.pullIndicator, pullIndicatorStyle]} pointerEvents="none">
        <BreathingHeart size={26} color={P.accentGold} />
      </Animated.View>
      {refreshing && (
        <View style={styles.pullIndicator} pointerEvents="none">
          <BreathingHeart size={26} color={P.accentGold} />
        </View>
      )}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        onScroll={(e) => { handleGridScroll(e.nativeEvent.contentOffset.y); }}
        scrollEventThrottle={16}
      >
        {/* Wrapping gutter + the horizontal ScrollView in a plain row View,
            the outer ScrollView's single child, gives that row a real
            bounded width (the screen width) to lay out against -- same
            structure MultiDayView uses. */}
        <View style={{ flexDirection: 'row' }}>
          {/* Time gutter */}
          <View style={{ width: TIME_GUTTER, height: totalHeight }}>
            {labels.map(l => (
              <Text key={l.minutes} style={[styles.hourLabel, { top: (l.minutes - gridStart) * pxPerMinute - 7 }]}>
                {l.label}
              </Text>
            ))}
            {isToday && (() => {
              const nowMin = zonedMinutesSinceMidnight(new Date().toISOString(), timeZone);
              if (nowMin < gridStart || nowMin > gridEnd) return null;
              return (
                <View style={[styles.nowBadge, { top: (nowMin - gridStart) * pxPerMinute - 14 }]}>
                  <Text style={styles.nowBadgeText}>{zonedClockLabel(new Date(), timeZone)}</Text>
                </View>
              );
            })()}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => { scrollX.value = e.nativeEvent.contentOffset.x; }}
            scrollEventThrottle={16}
          >
            <View style={{ height: totalHeight, width: rowWidth }}>
              {/* Gridlines -- quarter-hour minor ticks render first (below,
                  fainter), major labeled ticks on top so a coinciding
                  minute (e.g. the top of the hour) always shows the
                  stronger line. */}
              <View style={styles.gridBackground}>
                {minorLabels.map(l => (
                  <View key={`minor-${l.minutes}`} style={[styles.gridLineMinor, { top: (l.minutes - gridStart) * pxPerMinute }]} />
                ))}
                {labels.map(l => (
                  <View key={l.minutes} style={[styles.gridLine, { top: (l.minutes - gridStart) * pxPerMinute }]} />
                ))}
              </View>

              {/* Closed-hours fringe moved into the per-column loop below --
                  a real staff column shades by that person's own hours
                  (scheduleForColumn), not the salon-wide band that used to
                  span every column identically. */}

              {/* Block Time background layer — a time_block booking is NOT
                  an appointment; it represents a period where new
                  availability is closed. Rendered as a full-width
                  background band (never a card competing for column
                  space), sitting below Smart Gap and appointment cards in
                  the z-order below. Merges overlapping/adjacent blocks for
                  display only -- see mergeBlockIntervals -- so two blocks
                  covering a continuous span read as one seamless closed
                  period instead of two stacked/competing cards. */}
              <BlockTimeBands
                bookings={bookings}
                gridStart={gridStart}
                pxPerMinute={pxPerMinute}
                rowWidth={rowWidth}
                timeZone={timeZone}
                onOpenBooking={onOpenBooking}
              />

              {/* Live "now" line -- salon-local time (Calendar 2.0 Part 9),
                  its badge rendered in the time gutter above. */}
              {isToday && (() => {
                const nowMin = zonedMinutesSinceMidnight(new Date().toISOString(), timeZone);
                if (nowMin < gridStart || nowMin > gridEnd) return null;
                return <View style={[styles.nowLine, { top: (nowMin - gridStart) * pxPerMinute, width: rowWidth }]} />;
              })()}

              <View style={{ flexDirection: 'row' }}>
                {columns.map((col, colIndex) => {
                  // Block Time background-layer pass — a time_block row is
                  // not an appointment and must not consume a slot in the
                  // side-by-side overlap layout (that's exactly what made it
                  // render as a card competing for column width). It's
                  // rendered separately below as a full-width background
                  // band instead, so it's excluded here entirely.
                  const colBookings = bookings.filter(b => columnForBooking(b) === colIndex && b.status !== 'cancelled' && b.source !== 'time_block');
                  const overlapLayout = layoutOverlaps(colBookings);
                  // Staff-columns restore — this column's own shift bounds,
                  // falling back to the salon-wide `schedule` for
                  // Unassigned/All/no-availability-configured (identical to
                  // the old global bands in every one of those cases).
                  const colSchedule = scheduleForColumn(col);
                  const colClosedTopHeight = colSchedule.open === false ? totalHeight : Math.max(0, colSchedule.start * 60 - gridStart) * pxPerMinute;
                  const colClosedBottomTop = Math.max(0, colSchedule.end * 60 - gridStart) * pxPerMinute;
                  const colClosedBottomHeight = colSchedule.open === false ? 0 : Math.max(0, gridEnd - colSchedule.end * 60) * pxPerMinute;
                  // A real staff column passes ITS OWN id for a fill-slot tap
                  // (so tapping Tina's empty column books Tina, not nobody);
                  // the Unassigned/All synthetic columns still pass null,
                  // same as before ("All Staff" auto-assigns from null).
                  const colStaffId = typeof col.id === 'string' && col.id !== 'all' ? col.id : null;
                  return (
                    <View key={col.id ?? 'unassigned'} style={{ width: columnWidth, height: totalHeight, borderRightWidth: 1, borderRightColor: P.border }}>
                      {col.id !== 'all' && <Text style={styles.columnLabel}>{col.label}</Text>}
                      {/* Closed-hours fringe (and fully closed days, via
                          colClosedTopHeight covering the whole column) is
                          still tappable to book -- an owner may have a staff
                          member coming in early/late, or want to log a
                          walk-in on a day marked closed. `onFillSlot`'s
                          outsideHours flag lets the caller show a reminder
                          that no staff may actually be scheduled then. */}
                      {colClosedTopHeight > 0 && (
                        <View style={[styles.closedBand, { top: 0, height: colClosedTopHeight, width: columnWidth }]} pointerEvents="none" />
                      )}
                      {colClosedBottomHeight > 0 && (
                        <View style={[styles.closedBand, { top: colClosedBottomTop, height: colClosedBottomHeight, width: columnWidth }]} pointerEvents="none" />
                      )}
                      {onFillSlot && colClosedTopHeight > 0 && (
                        <ClosedSlotBlock
                          top={0}
                          height={colClosedTopHeight}
                          gridStart={gridStart}
                          pxPerMinute={pxPerMinute}
                          onPressAt={(tappedMinutes) => {
                            const dayBase = new Date(date);
                            dayBase.setHours(0, 0, 0, 0);
                            const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
                            onFillSlot(startsAt, colStaffId, true);
                          }}
                        />
                      )}
                      {onFillSlot && colClosedBottomHeight > 0 && (
                        <ClosedSlotBlock
                          top={colClosedBottomTop}
                          height={colClosedBottomHeight}
                          gridStart={gridStart}
                          pxPerMinute={pxPerMinute}
                          onPressAt={(tappedMinutes) => {
                            const dayBase = new Date(date);
                            dayBase.setHours(0, 0, 0, 0);
                            const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
                            onFillSlot(startsAt, colStaffId, true);
                          }}
                        />
                      )}
                      {colBookings.map(b => {
                        const slot = overlapLayout.get(b.id) ?? { slotIndex: 0, slotCount: 1 };
                        return (
                          <AppointmentBlock
                            key={b.id}
                            booking={b}
                            gridStart={gridStart}
                            pxPerMinute={pxPerMinute}
                            timeZone={timeZone}
                            columns={columns}
                            colIndex={colIndex}
                            columnWidth={columnWidth}
                            slotIndex={slot.slotIndex}
                            slotCount={slot.slotCount}
                            onOpen={() => onOpenBooking(b)}
                            onChanged={onChanged}
                            onOpenAnother={onOpenAnother}
                          />
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
      {isToday && showNowButton && (
        // Plain Pressable, same as everything else here, is inside the
        // outer backgroundGesture's GestureDetector tree and its tap can
        // get swallowed the same way the ScrollView's pan did before that
        // was fixed -- wrapping it in its own Gesture.Tap(), the same
        // pattern AppointmentBlock already uses for its own tap-to-open,
        // is what actually makes it reliably tappable.
        <GestureDetector gesture={Gesture.Tap().onEnd(() => runOnJS(scrollToNow)())}>
          <View style={styles.nowButton}>
            <Ionicons name="locate" size={16} color="#FFFFFF" />
            <Text style={styles.nowButtonText}>{i18n.t('calendar:timeline.now')}</Text>
          </View>
        </GestureDetector>
      )}
      </View>
    </GestureDetector>
    </TimelineErrorBoundary>
  );
}

class TimelineErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[TimelineCalendar] render crashed', error); }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg }}>
          <Text style={{ color: P.textSecondary, textAlign: 'center' }}>{i18n.t('calendar:timeline.couldNotLoadTimeline')}{'\n'}{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

interface OverlapSlot { slotIndex: number; slotCount: number }

// Column-packing layout for same-staff double-bookings (availability-
// override, Sprint N) -- assigns each overlapping booking a side-by-side
// slot instead of letting them draw on top of each other. Standard
// "meeting scheduler" algorithm: sweep bookings in start order, place each
// in the first column whose last occupant already ended, opening a new
// column when none are free; a cluster's slotCount is the most columns
// that were ever simultaneously in use within that connected overlap group
// (not the whole day's max), reset once no booking is left open.
function layoutOverlaps(bookings: OwnerBooking[]): Map<string, OverlapSlot> {
  const layout = new Map<string, OverlapSlot>();
  const sorted = [...bookings].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  const columnEnds: number[] = [];
  let cluster: { id: string; colIndex: number }[] = [];
  let clusterMaxCols = 0;
  let clusterEndMax = -Infinity;

  function flush() {
    for (const item of cluster) {
      layout.set(item.id, { slotIndex: item.colIndex, slotCount: clusterMaxCols });
    }
    cluster = [];
    clusterMaxCols = 0;
    clusterEndMax = -Infinity;
  }

  for (const b of sorted) {
    const startMs = new Date(b.starts_at).getTime();
    const endMs = new Date(b.ends_at).getTime();

    if (cluster.length > 0 && startMs >= clusterEndMax) {
      flush();
      columnEnds.length = 0;
    }

    let colIndex = columnEnds.findIndex(end => end <= startMs);
    if (colIndex === -1) { colIndex = columnEnds.length; columnEnds.push(endMs); }
    else columnEnds[colIndex] = endMs;

    cluster.push({ id: b.id, colIndex });
    clusterMaxCols = Math.max(clusterMaxCols, columnEnds.length);
    clusterEndMax = Math.max(clusterEndMax, endMs);
  }
  flush();

  return layout;
}

function initialsAvatarColor(name: string): string {
  // Deterministic, not random -- the same customer always gets the same
  // avatar tint across renders/sessions.
  const palette = [P.sourceOnline, P.sourceWalkIn, P.secondaryPurple, P.sourceManual, '#EC4899', '#38BDF8'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

function AppointmentBlock({
  booking, gridStart, pxPerMinute, timeZone, columns, colIndex, onOpen, onChanged, onOpenAnother,
  columnWidth, slotIndex = 0, slotCount = 1,
}: {
  booking: OwnerBooking; gridStart: number; pxPerMinute: number; timeZone: string;
  columns: Column[]; colIndex: number; onOpen: () => void; onChanged: () => void;
  // Long-press-then-release-without-dragging on an occupied block -- the
  // owner's way to intentionally book a second appointment at this same
  // slot (availability-override, Sprint N), since the grid's own empty-space
  // tap targets stop at existing bookings' boundaries.
  onOpenAnother?: (startsAt: Date, staffId: string | null) => void;
  // Side-by-side overlap layout (availability-override double-bookings) --
  // slotCount > 1 splits the column's width evenly; slotIndex picks which
  // of those slots this block renders in.
  columnWidth?: number; slotIndex?: number; slotCount?: number;
}) {
  const startMin = zonedMinutesSinceMidnight(booking.starts_at, timeZone);
  const endMin = zonedMinutesSinceMidnight(booking.ends_at, timeZone);
  const durationMin = Math.max(15, endMin - startMin);
  const baseTop = (startMin - gridStart) * pxPerMinute;
  const baseHeight = Math.max(44, durationMin * pxPerMinute); // fits the avatar circle + padding without clipping

  // Overlap slot geometry -- undefined when slotCount is 1 so the block
  // falls back to the plain full-width `styles.block` (left/right), exactly
  // as before this feature existed.
  const overlapStyle = slotCount > 1 && columnWidth
    ? (() => {
        const availableWidth = columnWidth - 16;
        const slotWidth = availableWidth / slotCount;
        return { left: 8 + slotIndex * slotWidth, width: Math.max(40, slotWidth - 4), right: undefined };
      })()
    : null;

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dragging = useSharedValue(false);
  const resizeHeight = useSharedValue(0); // live delta while dragging the bottom handle
  const resizing = useSharedValue(false);
  const [busy, setBusy] = useState(false);

  const isBlockedTime = booking.source === 'time_block';
  const isTerminal = booking.status === 'cancelled' || booking.status === 'no_show';
  // Calendar parity pass (audit §10) — main block color now keys off
  // appointment STATUS (matching Fresha, and matching how MultiDayView's
  // 3-Day/Week columns already colored their own blocks), not booking
  // SOURCE. Source moved to a secondary role: it still drives the corner
  // badge (cornerIcon() below) whenever status isn't one of the more urgent
  // states that badge already prioritizes.
  const color = isRebookNudgeBooking(booking) ? REBOOK_NUDGE_COLOR
    : isBlockedTime ? P.sourceBlock
    : bookingStatusColor(booking).color;
  const action = nextAction(booking);

  // Horizontal drag first tries to reassign the block to a different staff
  // column (existing behavior, multi-column view only). Once the drag goes
  // past the first/last column, the leftover distance beyond that edge pages
  // across days instead -- one COLUMN_WIDTH of extra drag = one day, so
  // holding and continuing to drag right/left keeps advancing. In a
  // single-column view there's no column to reassign, so the entire
  // horizontal distance goes straight to day-paging.
  function finishDrag(translationY: number, translationX: number) {
    const deltaMinutes = snapMinutes(translationY / pxPerMinute);
    const totalColUnits = Math.round(translationX / COLUMN_WIDTH);
    const rawColIndex = colIndex + totalColUnits;
    const newColIndex = Math.min(columns.length - 1, Math.max(0, rawColIndex));
    const dayOffset = rawColIndex - newColIndex;
    const newStartMinutes = Math.max(0, startMin + deltaMinutes);
    if (deltaMinutes !== 0 || newColIndex !== colIndex || dayOffset !== 0) {
      confirmMove(newStartMinutes, newColIndex, dayOffset);
    } else {
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      if (onOpenAnother) onOpenAnother(new Date(booking.starts_at), booking.staff_id);
    }
  }

  function confirmMove(newStartMinutes: number, newColIndex: number, dayOffset: number) {
    // Correction pass — sample/demo bookings (Parts 35/36's deterministic
    // fixture) have synthetic ids that don't exist in the real bookings
    // table. Letting the drag reach commitMove() for one of these used to
    // show a real "Reschedule appointment?" dialog and then fail with a
    // genuinely misleading "Booking not found" once Save was tapped -- the
    // gesture itself is real, but there's nothing on the server for it to
    // update. Stopping here, before that dialog, is what actually prevents
    // the misleading error rather than just rewording it.
    if (isSampleBooking(booking.id)) {
      Alert.alert(i18n.t('calendar:timeline.sampleDataTitle'), i18n.t('calendar:timeline.sampleDataMoveMessage'));
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      return;
    }
    const dayBase = new Date(booking.starts_at);
    dayBase.setHours(0, 0, 0, 0);
    dayBase.setDate(dayBase.getDate() + dayOffset);
    const newStart = new Date(dayBase.getTime() + newStartMinutes * 60000);
    const dateLabel = formatWeekdayMonthDay(newStart);
    const timeLabel = formatTimeShortInTZ(newStart, timeZone);

    Alert.alert(
      i18n.t('calendar:timeline.rescheduleTitle'),
      i18n.t('calendar:timeline.moveConfirm', { customerName: booking.customer ? customerDisplayName(booking) : i18n.t('calendar:timeline.thisAppointment'), date: dateLabel, time: timeLabel }),
      [
        {
          text: i18n.t('calendar:timeline.ignore'), style: 'cancel', onPress: () => {
            translateY.value = withSpring(0);
            translateX.value = withSpring(0);
          },
        },
        { text: i18n.t('calendar:timeline.reschedule'), onPress: () => commitMove(newStartMinutes, newColIndex, dayOffset) },
      ],
    );
  }

  async function commitMove(newStartMinutes: number, newColIndex: number, dayOffset: number, overrideConflict = false) {
    // Staff-columns restore — dragging a card sideways into a real staff
    // column now reassigns it (this arithmetic, and the "past the first/
    // last column pages days instead" fallback, already existed and just
    // wasn't being read here). Dropped into the synthetic "All"/"Unassigned"
    // fallback that only appears when this salon has no active staff at
    // all keeps the booking's own staff unchanged; dropped into an actual
    // Unassigned column (col.id === null, only shown when a real
    // unassigned booking exists today) explicitly clears staff_id.
    const targetCol = columns[newColIndex];
    const newStaffId = !targetCol || targetCol.id === 'all' ? booking.staff_id : targetCol.id;
    const dayBase = new Date(booking.starts_at);
    dayBase.setHours(0, 0, 0, 0);
    dayBase.setDate(dayBase.getDate() + dayOffset);
    const newStart = new Date(dayBase.getTime() + newStartMinutes * 60000);
    const newEnd = new Date(newStart.getTime() + durationMin * 60000);

    setBusy(true);
    const result = await updateBooking(booking.id, {
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
      staff_id: newStaffId,
      ...(overrideConflict ? { override_conflict: true } : {}),
    });
    setBusy(false);

    if (result.ok) {
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      onChanged();
      return;
    }

    if (result.code === 'CONFLICT' && !overrideConflict) {
      // Deliberately not springing back here -- the block stays exactly
      // where it was dropped until the owner actually decides, matching
      // confirmMove's own Ignore/Reschedule pattern above.
      Alert.alert(
        i18n.t('calendar:timeline.timeSlotTaken'),
        i18n.t('calendar:timeline.staffAlreadyHasAppointment', { staffName: columns[newColIndex]?.label ?? booking.staff?.name ?? i18n.t('calendar:timeline.thatStaffMember') }),
        [
          { text: i18n.t('calendar:timeline.cancel'), style: 'cancel', onPress: () => { translateY.value = withSpring(0); translateX.value = withSpring(0); } },
          { text: i18n.t('calendar:timeline.doubleBook'), style: 'destructive', onPress: () => commitMove(newStartMinutes, newColIndex, dayOffset, true) },
        ],
      );
      return;
    }

    translateY.value = withSpring(0);
    translateX.value = withSpring(0);
    Alert.alert(i18n.t('calendar:timeline.couldNotMoveAppointment'), result.error);
  }

  // Calendar 2.0 Part 19/20/21/22 — bottom-edge resize. START TIME is never
  // touched; only ends_at changes, snapped to 15-minute increments (the
  // reference's stated primary granularity -- finer than the drag-to-move
  // gesture's own 5-minute snap, deliberately coarser here since a duration
  // change is a bigger, more consequential edit than a small nudge).
  // Reuses resizeBooking() (ownerBookings.ts), which sends ONLY ends_at
  // through the exact same PATCH /api/owner/bookings/[id] used by move --
  // same conflict check, same `locked` guard, same idempotent-safe request
  // shape. Never touches the service's own default duration.
  function finishResize(translationY: number) {
    const deltaMinutes = snapMinutes(translationY / pxPerMinute, 15);
    const newDurationMin = Math.max(15, durationMin + deltaMinutes);
    if (newDurationMin === durationMin) {
      resizeHeight.value = withSpring(0);
      return;
    }
    confirmResize(newDurationMin);
  }

  function confirmResize(newDurationMin: number) {
    // Correction pass — same sample-data guard as confirmMove() above, for
    // the same reason: a synthetic fixture id has nothing on the server to
    // PATCH, so stop before the confirm dialog rather than show one that's
    // followed by a misleading "Booking not found".
    if (isSampleBooking(booking.id)) {
      Alert.alert(i18n.t('calendar:timeline.sampleDataTitle'), i18n.t('calendar:timeline.sampleDataResizeMessage'));
      resizeHeight.value = withSpring(0);
      return;
    }
    const newEnd = new Date(new Date(booking.starts_at).getTime() + newDurationMin * 60000);
    const startLabel = formatTimeShortInTZ(new Date(booking.starts_at), timeZone);
    const endLabel = formatTimeShortInTZ(newEnd, timeZone);
    Alert.alert(
      isBlockedTime ? i18n.t('calendar:timeline.changeBlockLength') : i18n.t('calendar:timeline.changeAppointmentLength'),
      isBlockedTime
        ? i18n.t('calendar:timeline.lengthChangeBlockDetail', { start: startLabel, end: endLabel, minutes: newDurationMin })
        : i18n.t('calendar:timeline.lengthChangeApptDetail', { start: startLabel, end: endLabel, minutes: newDurationMin, customerName: customerDisplayName(booking) }),
      [
        { text: i18n.t('calendar:timeline.cancel'), style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
        { text: i18n.t('calendar:timeline.save'), onPress: () => commitResize(newEnd, false) },
      ],
    );
  }

  async function commitResize(newEnd: Date, overrideConflict: boolean) {
    setBusy(true);
    const result = await resizeBooking(booking.id, newEnd.toISOString(), overrideConflict);
    setBusy(false);

    if (result.ok) {
      resizeHeight.value = withSpring(0);
      onChanged();
      return;
    }
    if (result.code === 'CONFLICT' && !overrideConflict) {
      Alert.alert(
        i18n.t('calendar:timeline.timeSlotTaken'),
        i18n.t('calendar:timeline.extendingWouldOverlap'),
        [
          { text: i18n.t('calendar:timeline.cancel'), style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
          { text: i18n.t('calendar:timeline.doubleBook'), style: 'destructive', onPress: () => commitResize(newEnd, true) },
        ],
      );
      return;
    }
    resizeHeight.value = withSpring(0);
    Alert.alert(i18n.t('calendar:timeline.couldNotChangeLength'), result.error);
  }

  const resizeDrag = Gesture.Pan()
    .onBegin(() => { resizing.value = true; })
    .onUpdate((e) => { resizeHeight.value = e.translationY; })
    .onEnd((e) => {
      resizing.value = false;
      runOnJS(finishResize)(e.translationY);
    });

  // Calendar 2.0 Part 19 — the handle used to be a child of the card's own
  // Animated.View (styles.block), which has overflow:'hidden' (needed to
  // clip BlockStripes/rounded corners). That silently clipped the handle's
  // own touch target too -- confirmed on-device: touches at the handle's
  // exact rendered pixel position were consistently resolved as the card's
  // own long-press-drag instead, because the portion of the handle meant to
  // extend past the card's bottom edge was outside the clipped hit region.
  // Rendering it as a sibling, positioned independently (not clipped by the
  // card), is what actually makes it hittable as its own gesture target.
  const resizeHandleStyle = useAnimatedStyle(() => ({
    top: baseTop + baseHeight + resizeHeight.value - 8,
  }));

  async function runSwipeAction(direction: 'left' | 'right') {
    if (isSampleBooking(booking.id)) {
      Alert.alert(i18n.t('calendar:timeline.sampleDataTitle'), i18n.t('calendar:timeline.sampleDataStatusMessage'));
      return;
    }
    setBusy(true);
    let result;
    if (direction === 'right') {
      // Swipe right = Check In (Phase 0.3)
      if (!action || action.key !== 'check_in') { setBusy(false); return; }
      result = await checkIn(booking.id);
    } else {
      // Swipe left = advance toward checkout. Real Checkout Mode is Sprint 4 --
      // this advances the state machine as far as Sprint 2's own scope owns.
      if (action?.key === 'start_service') result = await startService(booking.id);
      else if (action?.key === 'mark_complete') result = await completeService(booking.id);
      else { setBusy(false); return; }
    }
    setBusy(false);
    if (result?.ok) onChanged();
    else if (result) Alert.alert(i18n.t('calendar:timeline.couldNotUpdate'), result.error);
  }

  const longPressDrag = Gesture.Pan()
    .activateAfterLongPress(280)
    .onBegin(() => { dragging.value = true; })
    .onUpdate((e) => {
      translateY.value = e.translationY;
      // Tracked unconditionally now (was gated to multi-column views only)
      // -- horizontal drag also drives day-paging in a single-column view,
      // where there's no staff column to reassign.
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      dragging.value = false;
      // Deliberately NOT springing back here -- the block stays exactly
      // where it was dropped (matching where the Reschedule confirmation
      // below says it'll land) until the owner actually confirms or
      // dismisses. confirmMove()'s Ignore button and commitMove() (success
      // or failure) are what spring it back.
      // snapMinutes() is a plain JS function, not a worklet -- calling it
      // directly here (UI thread) throws "Tried to synchronously call a
      // Remote Function" under the current react-native-worklets runtime.
      // Do the snap/column math in finishDrag() on the JS thread instead,
      // same as commitMove() already does.
      runOnJS(finishDrag)(e.translationY, e.translationX);
    });

  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => runOnJS(runSwipeAction)('right'));
  const flingLeft  = Gesture.Fling().direction(Directions.LEFT).onEnd(() => runOnJS(runSwipeAction)('left'));
  const tap = Gesture.Tap().onEnd(() => runOnJS(onOpen)());

  const composed = Gesture.Race(flingLeft, flingRight, longPressDrag, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    height: Math.max(30, baseHeight + resizeHeight.value),
    zIndex: dragging.value || resizing.value ? 10 : 1,
    opacity: busy ? 0.6 : 1,
    // Part 18 — "selected card lifts slightly, subtle glow" while dragging
    // or resizing.
    shadowOpacity: dragging.value || resizing.value ? 0.5 : 0,
  }));

  const pill = primaryPill(booking);
  const corner = cornerIcon(booking);
  const showMeta = baseHeight >= 44;
  // Calendar parity pass (audit §09) — Fresha renders a multi-service
  // booking as stacked sub-segments, each with its own start time, instead
  // of one joined label. Segment boundaries are an even split of the real
  // total duration (per-service durations live in the services catalog,
  // not on the booking itself, and aren't worth threading through this
  // component's drag/resize gesture tree just for a label) -- still
  // genuinely time-ordered along the appointment's actual span, not a
  // fake/decorative breakdown.
  const serviceNames = booking.service_names ?? [];
  const isMultiService = serviceNames.length > 1;
  const segmentMinutes = isMultiService ? durationMin / serviceNames.length : durationMin;
  const compact = baseHeight < 60; // ~15-min card at 1x zoom -- tighter content per Part 12
  // Card pass Part 10 — a genuinely overlapping card (slotCount > 1, so
  // this card only gets a fraction of the column's width) can't fit the
  // standard time-col/avatar/name/service/right-col row layout without
  // text and badges colliding -- that's the actual bug in the reported
  // screenshot, not a duration/height problem (`compact` above). This is
  // a width condition, independent of and additive to `compact`.
  const narrow = slotCount > 1;
  // Mobile overlap fix — the real rendered pixel width of a narrow card
  // (overlapStyle's own math, reused rather than recomputed), so the mini
  // card can decide whether an icon has genuinely enough room instead of
  // guessing from slotCount alone (3 cards at 400px column width have far
  // more room per card than 3 cards at 200px).
  const narrowSlotWidth = overlapStyle?.width ?? Infinity;
  // Short-narrow cleanup — the first pass's thresholds (44/60) were tuned
  // blind and turned out far too permissive: at the density pass's own
  // pxPerMinute, almost every appointment under ~45-60 minutes sits right
  // at or just above the 44px floor, so nearly everything qualified for at
  // least the middle tier and plenty hit 'full' -- exactly the visually
  // congested 10:55/11:00 cards from the reported screenshot. Raised
  // substantially and confirmed against real numbers: 'tall' now needs
  // genuine room for 4 stacked lines + top/bottom padding + resize-grip
  // clearance (~11 + 13 + 12 + 14px content/icon rows, 3px of gaps, 16px
  // of the card's own vertical padding, plus a few px of headroom before
  // the grip zone ≈ 74px); 'medium' needs room for 2 lines + padding
  // (~11 + 13 + 16 ≈ 46px, rounded up for breathing room). Anything
  // shorter shows initials only -- legibility over density, per spec.
  const narrowTier: 'tall' | 'medium' | 'short' = baseHeight < 52 ? 'short' : baseHeight < 80 ? 'medium' : 'tall';

  if (isBlockedTime) {
    // Correction pass Part 5 — Blocked Time reuses the exact same resize
    // infrastructure (resizeDrag/finishResize/confirmResize/commitResize,
    // all defined above and already generic across booking sources) rather
    // than a separate gesture built just for blocks. Only the end time
    // changes; start time is untouched, same as a real appointment's
    // resize. Also switched the open-tap from a plain Pressable to
    // Gesture.Tap(), matching the fix already proven elsewhere in this
    // file for anything living inside the outer backgroundGesture's tree,
    // and made the whole card tappable (not just the small icon) so it
    // behaves like every other card.
    const blockTap = Gesture.Tap().onEnd(() => runOnJS(onOpen)());
    return (
      <>
      <GestureDetector gesture={blockTap}>
        <Animated.View style={[styles.blockedCard, { top: baseTop, height: baseHeight }, overlapStyle, animatedStyle]}>
          <BlockStripes />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.blockedTime} numberOfLines={1}>
              {formatTimeShortInTZ(new Date(booking.starts_at), timeZone)}
              {' – '}
              {formatTimeShortInTZ(new Date(booking.ends_at), timeZone)}
              {'  ·  '}{durationMin}m
            </Text>
            <Text style={styles.blockedTitle} numberOfLines={1}>{i18n.t('calendar:timeline.blockedTimeTitle')}</Text>
            {!!booking.internal_notes && <Text style={styles.blockedReason} numberOfLines={1}>{booking.internal_notes}</Text>}
          </View>
          <View style={styles.blockedIconWrap}>
            <Ionicons name="ban-outline" size={16} color="rgba(255,255,255,0.5)" />
          </View>
        </Animated.View>
      </GestureDetector>
      {!isTerminal && (
        <GestureDetector gesture={resizeDrag}>
          <Animated.View style={[styles.resizeHandleZone, overlapStyle, resizeHandleStyle]}>
            <View style={styles.resizeHandleGrip} />
          </Animated.View>
        </GestureDetector>
      )}
      </>
    );
  }

  const timeLabel = formatTimeShortInTZ(new Date(booking.starts_at), timeZone);
  // Short-narrow cleanup Part 2 — "10:55 AM" in an already-tight column
  // was reading as if two separate values were stacked. numberOfLines={1}
  // truncating a too-wide string still looks broken; dropping the AM/PM
  // suffix (spec explicitly allows this) keeps it a genuinely short,
  // single-token string that always fits one line at any narrow width.
  // i18n foundation (L5B) -- broadened from a strict "AM"/"PM"-only match so
  // this still strips the meridiem in Spanish's Intl output too (e.g.
  // "9:00 a.m." / "9:00 p. m.", which vary by ICU spacing/punctuation).
  const narrowTimeLabel = timeLabel.replace(/\s?[ap]\.?\s?m\.?$/i, '');

  return (
    <>
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          styles.block,
          // Short-narrow cleanup Part 5 — investigated whether Blocked
          // Time and an appointment could ever land in the same visual
          // slot: they can't (layoutOverlaps() clusters every booking in
          // the column together regardless of source and always assigns
          // time-overlapping ones distinct slotIndex/slotCount, confirmed
          // by reading it before touching anything -- not a geometry bug).
          // What was real: a narrow card's background is a very
          // translucent tint (⅛ opacity) by design for the full-width
          // look, and at that opacity two tightly-packed narrow cards
          // sitting close together read as bleeding into each other/the
          // dark grid behind them. Bumped opacity only for narrow cards
          // (full-width cards, already approved, keep the original tint)
          // so each mini card reads as a solid, self-contained block.
          { top: baseTop, borderLeftColor: color, backgroundColor: color + (narrow ? '38' : '1F') },
          isTerminal && styles.blockTerminal,
          overlapStyle, animatedStyle,
        ]}
      >
        {narrow ? (
          // Mobile overlap fix — a purpose-built mini card, not a squeezed
          // copy of the standard layout. Never: end time, duration,
          // service name, source text, or PAID/UNPAID/DEPOSIT pill text --
          // only start time, initials, and price, stacked and centered.
          // narrowTier sheds content by height (tall: time+initials+
          // price+icon; medium: time+initials; short: initials alone) so
          // a short overlap slot never tries to force in content it has
          // no room for.
          <View style={[styles.narrowContent, { overflow: 'hidden' }, narrowTier === 'tall' && styles.narrowContentTall]}>
            {narrowTier !== 'short' && (
              <Text style={styles.narrowTimeText} numberOfLines={1}>{narrowTimeLabel}</Text>
            )}
            <Text style={styles.narrowNameText} numberOfLines={1}>{initials(customerDisplayName(booking))}</Text>
            {narrowTier === 'tall' && !isTerminal && !!booking.price_cents && (
              <Text style={styles.narrowPriceText} numberOfLines={1}>{formatCentsUSDWhole(booking.price_cents)}</Text>
            )}
            {/* Rule 9 — one tiny icon, only when there's genuinely enough
                room (tallest tier AND a slot wide enough that it won't
                crowd the initials/price above it); omitted otherwise
                rather than forced in. */}
            {narrowTier === 'tall' && narrowSlotWidth >= 46 && (
              <View style={[styles.cornerIconWrapSmall, { borderColor: color }]}>
                {corner.kind === 'source' && corner.source === 'sanaa' && <SanaaMark variant="bookingAttribution" size={9} />}
                {corner.kind === 'source' && corner.source === 'online' && <Ionicons name="globe" size={8} color={color} />}
                {corner.kind === 'source' && corner.source === 'walk_in' && <Ionicons name="person" size={8} color={color} />}
                {corner.kind === 'source' && (corner.source === 'manual' || corner.source === 'other') && <Ionicons name="person" size={8} color={color} />}
                {corner.kind === 'status' && corner.status === 'checked_in' && <Ionicons name="checkmark-circle" size={9} color={P.info} />}
                {corner.kind === 'status' && corner.status === 'in_service' && <Ionicons name="ellipse" size={7} color={P.secondaryPurple} />}
                {corner.kind === 'status' && corner.status === 'late' && <Ionicons name="time" size={8} color={P.warning} />}
                {corner.kind === 'status' && corner.status === 'no_show' && <Ionicons name="alert-circle" size={9} color={P.error} />}
                {corner.kind === 'status' && corner.status === 'cancelled' && <Ionicons name="close-circle" size={9} color={P.error} />}
              </View>
            )}
          </View>
        ) : (
          <>
            <View style={styles.blockTimeCol}>
              <Text style={styles.blockTimeText} numberOfLines={1}>{timeLabel}</Text>
              {!compact && <Text style={styles.blockDurationText}>{durationMin}m</Text>}
            </View>

            {!isTerminal && (
              <View style={[styles.blockAvatar, { borderColor: color, backgroundColor: initialsAvatarColor(customerDisplayName(booking)) + '33' }]}>
                <Text style={[styles.blockAvatarText, { color: initialsAvatarColor(customerDisplayName(booking)) }]}>
                  {initials(customerDisplayName(booking))}
                </Text>
              </View>
            )}

            <View style={{ flex: 1, minWidth: 0 }}>
              {/* Hierarchy pass — customer name is now the strongest text
                  on the card (blockCustomer bumped up), service is
                  secondary/dimmer (blockMeta, unchanged weight), and the
                  separate labeled source pill ("SANAA Booking", "Online
                  Booking"...) that used to sit under the service line is
                  gone -- the left accent border + the small corner icon
                  already carry source identity; a name-sized label for it
                  outranked service/staff in the old layout, which is
                  backwards per the requested priority order (source icon
                  is priority 7, lowest, not priority 4's equal). */}
              <View style={styles.blockNameRow}>
                <Text style={styles.blockCustomer} numberOfLines={1}>{customerDisplayName(booking)}</Text>
                {booking.customer?.priority && <Ionicons name="star" size={11} color={P.accentGold} />}
                {!booking.customer?.priority && (booking.customer?.total_bookings ?? 0) <= 1 && (
                  <View style={styles.newChip}><Text style={styles.newChipText}>{i18n.t('calendar:timeline.newChip')}</Text></View>
                )}
              </View>
              {showMeta && isMultiService && !compact && !narrow ? (
                <View style={styles.serviceSegments}>
                  {serviceNames.map((name, i) => {
                    const segStart = new Date(new Date(booking.starts_at).getTime() + i * segmentMinutes * 60000);
                    return (
                      <Text key={i} style={styles.blockMetaSegment} numberOfLines={1}>
                        {formatTimeShortInTZ(segStart, timeZone)} · {name}
                      </Text>
                    );
                  })}
                </View>
              ) : showMeta && (
                <Text style={styles.blockMeta} numberOfLines={1}>
                  {serviceDisplayName(booking)}{booking.staff?.name ? ` · ${booking.staff.name}` : ''}
                </Text>
              )}
            </View>

            <View style={styles.blockRightCol}>
              {pill && (
                <View style={[
                  styles.pill,
                  pill.kind === 'cancelled' || pill.kind === 'no_show'
                    ? { borderColor: P.error, backgroundColor: P.error + '26' }
                    : { borderColor: PAYMENT_COLOR[pill.badge], backgroundColor: PAYMENT_COLOR[pill.badge] + '26' },
                ]}>
                  <Text style={[
                    styles.pillText,
                    { color: pill.kind === 'cancelled' || pill.kind === 'no_show' ? P.error : PAYMENT_COLOR[pill.badge] },
                  ]}>
                    {pill.kind === 'cancelled' ? i18n.t('calendar:timeline.cancelledPill') : pill.kind === 'no_show' ? i18n.t('calendar:timeline.noShowPill') : paymentLabel(pill.badge)}
                  </Text>
                </View>
              )}
              {!isTerminal && !!booking.price_cents && (
                <Text style={styles.priceText}>{formatCentsUSDWhole(booking.price_cents)}</Text>
              )}
              {/* Card polish pass — the source/status corner icon was the
                  only piece of the right column with no height gating at
                  all (duration and, loosely, service already had some),
                  so on a short full-width card it was the thing most
                  likely to collide with or get silently clipped against
                  the pill/price above it. It's already the lowest-priority
                  element on the card (source identity is carried primarily
                  by the left accent border, this icon is just a
                  reinforcement) -- gating it behind the same `compact`
                  threshold as duration keeps a short card to its true
                  priority-1-through-3 content (name, time, price/status)
                  instead of cramming in a 4th element with no room. */}
              {!compact && (
                <View style={[styles.cornerIconWrap, { borderColor: color }]}>
                  {corner.kind === 'source' && corner.source === 'sanaa' && <SanaaMark variant="bookingAttribution" size={16} />}
                  {corner.kind === 'source' && corner.source === 'online' && <Ionicons name="globe" size={13} color={color} />}
                  {corner.kind === 'source' && corner.source === 'walk_in' && <Ionicons name="person" size={13} color={color} />}
                  {corner.kind === 'source' && (corner.source === 'manual' || corner.source === 'other') && <Ionicons name="person" size={13} color={color} />}
                  {corner.kind === 'status' && corner.status === 'checked_in' && <Ionicons name="checkmark-circle" size={14} color={P.info} />}
                  {corner.kind === 'status' && corner.status === 'in_service' && <Ionicons name="ellipse" size={12} color={P.secondaryPurple} />}
                  {corner.kind === 'status' && corner.status === 'late' && <Ionicons name="time" size={13} color={P.warning} />}
                  {corner.kind === 'status' && corner.status === 'no_show' && <Ionicons name="alert-circle" size={14} color={P.error} />}
                  {corner.kind === 'status' && corner.status === 'cancelled' && <Ionicons name="close-circle" size={14} color={P.error} />}
                </View>
              )}
            </View>
          </>
        )}

      </Animated.View>
    </GestureDetector>
    {/* Calendar 2.0 Part 19 — bottom-edge resize handle, rendered as a
        sibling (not a child) of the card above so the card's own
        overflow:'hidden' can't clip its touch target. A separate
        GestureDetector: RNGH resolves the touch to whichever detector's
        gesture claims it, and this one activates immediately (no
        long-press delay), so a touch starting on the handle always
        resizes, never moves. Nearly invisible by default, matching the
        spec. Shares overlapStyle's left/width so it lines up under the
        right card even when slotCount > 1 -- the ZONE (the actual touch
        target) is ALWAYS rendered, at its full width, regardless of tier:
        resize must stay usable on every card, including short-narrow
        ones. Short-narrow cleanup Part 3 — only the VISUAL grip inside it
        is now conditional: a narrow card only draws one at the 'tall'
        tier; medium/short narrow cards render the same invisible touch
        zone with no grip drawn at all (not just a smaller one), since
        there's no spare vertical room for it to sit without touching the
        initials/price text above. Resize still works by touching that
        same bottom-edge zone -- there's just nothing gray to see there. */}
    {!isTerminal && (
      <GestureDetector gesture={resizeDrag}>
        <Animated.View style={[styles.resizeHandleZone, overlapStyle, resizeHandleStyle]}>
          {(!narrow || narrowTier === 'tall') && (
            <View style={[styles.resizeHandleGrip, narrow && styles.resizeHandleGripNarrow]} />
          )}
        </Animated.View>
      </GestureDetector>
    )}
    </>
  );
}

function BlockStripes() {
  // Lightweight diagonal-stripe texture (Part 26) without any new
  // dependency -- a handful of thin rotated Views clipped by the parent's
  // overflow:hidden, repeated across the card width.
  const lines = Array.from({ length: 10 }, (_, i) => i);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map(i => (
        <View key={i} style={[styles.blockStripe, { left: i * 22 - 40 }]} />
      ))}
    </View>
  );
}

// Same tap target as OpenSlotBlock, but spanning an arbitrary top/height
// range in column coordinates instead of a computed gap -- used for the
// closed-hours fringe, which is still tappable to book.
function ClosedSlotBlock({ top, height, gridStart, pxPerMinute, onPressAt }: {
  top: number; height: number; gridStart: number; pxPerMinute: number; onPressAt: (tappedMinutes: number) => void;
}) {
  const tap = Gesture.Tap().onEnd((e) => {
    const tappedMinutes = snapMinutesWorklet(gridStart + (top + e.y) / pxPerMinute);
    runOnJS(onPressAt)(tappedMinutes);
  });
  return (
    <GestureDetector gesture={tap}>
      <View style={[styles.openTapTarget, { top, height }]} />
    </GestureDetector>
  );
}

interface MergedBlockBand { startMinutes: number; endMinutes: number; bookings: OwnerBooking[] }

// Block Time background-layer pass — rendering-only interval merge. Two (or
// more) blocked-time rows that overlap or touch (e.g. 10:30-12:30 and
// 12:00-1:00) must read as one continuous closed period, not two
// appointment-like cards sitting beside/on top of each other. This never
// touches the database: each merged band still carries every real booking
// it was built from, so tap/edit/resize always resolve back to actual rows.
function mergeBlockIntervals(bookings: OwnerBooking[], timeZone: string): MergedBlockBand[] {
  const blocks = bookings
    .filter(b => b.source === 'time_block' && b.status !== 'cancelled' && b.status !== 'no_show')
    .map(b => ({
      booking: b,
      start: zonedMinutesSinceMidnight(b.starts_at, timeZone),
      end: zonedMinutesSinceMidnight(b.ends_at, timeZone),
    }))
    .sort((a, b) => a.start - b.start);

  const bands: MergedBlockBand[] = [];
  for (const item of blocks) {
    const last = bands[bands.length - 1];
    if (last && item.start <= last.endMinutes) {
      last.endMinutes = Math.max(last.endMinutes, item.end);
      last.bookings.push(item.booking);
    } else {
      bands.push({ startMinutes: item.start, endMinutes: item.end, bookings: [item.booking] });
    }
  }
  return bands;
}

function BlockTimeBands({ bookings, gridStart, pxPerMinute, rowWidth, timeZone, onOpenBooking }: {
  bookings: OwnerBooking[]; gridStart: number; pxPerMinute: number; rowWidth: number; timeZone: string;
  onOpenBooking: (b: OwnerBooking) => void;
}) {
  const bands = useMemo(() => mergeBlockIntervals(bookings, timeZone), [bookings, timeZone]);
  if (bands.length === 0) return null;
  return (
    <>
      {bands.map((band, i) => (
        <BlockTimeBand
          key={`${band.startMinutes}-${i}`}
          band={band}
          gridStart={gridStart}
          pxPerMinute={pxPerMinute}
          rowWidth={rowWidth}
          timeZone={timeZone}
          onOpenBooking={onOpenBooking}
        />
      ))}
    </>
  );
}

// A single visual band -- may represent one real time_block row, or several
// merged ones (see mergeBlockIntervals). Deliberately renders no text on the
// timeline ("Blocked Time", reason, notes) -- those live only in the Block
// Time editor, opened via tap. Style is a dark, translucent, diagonally-
// striped band -- clearly not an appointment card (no avatar/name/price
// layout, no rounded card shadow, full timeline width).
function BlockTimeBand({ band, gridStart, pxPerMinute, rowWidth, timeZone, onOpenBooking }: {
  band: MergedBlockBand; gridStart: number; pxPerMinute: number; rowWidth: number; timeZone: string;
  onOpenBooking: (b: OwnerBooking) => void;
}) {
  const top = (band.startMinutes - gridStart) * pxPerMinute;
  const height = Math.max(18, (band.endMinutes - band.startMinutes) * pxPerMinute);
  const resizeHeight = useSharedValue(0);
  const resizing = useSharedValue(false);
  const [busy, setBusy] = useState(false);

  function openBand() {
    if (band.bookings.length === 1) {
      onOpenBooking(band.bookings[0]);
      return;
    }
    // Multiple real blocks overlap this exact point -- don't guess which
    // one the owner meant; offer a chooser that still opens the real
    // record (existing Block Time editor, via onOpenBooking).
    const fmt = (d: string) => formatTimeShortInTZ(new Date(d), timeZone);
    Alert.alert(
      i18n.t('calendar:timeline.multipleBlocksTitle'),
      i18n.t('calendar:timeline.multipleBlocksMessage'),
      [
        ...band.bookings.map(b => ({ text: `${fmt(b.starts_at)} – ${fmt(b.ends_at)}`, onPress: () => onOpenBooking(b) })),
        { text: i18n.t('calendar:timeline.cancel'), style: 'cancel' as const },
      ],
    );
  }

  const tap = Gesture.Tap().onEnd(() => runOnJS(openBand)());

  // Resize only applies when the band is exactly one real block -- a merged
  // band spanning two+ actual records has no single row a duration change
  // could mean. The owner still reaches each record's own resize by opening
  // it individually (chooser above, then the existing Block Time editor).
  const soleBooking = band.bookings.length === 1 ? band.bookings[0] : null;
  const canResize = !!soleBooking && soleBooking.status !== 'cancelled' && soleBooking.status !== 'no_show';

  function finishResize(translationY: number) {
    if (!soleBooking) return;
    const deltaMinutes = snapMinutes(translationY / pxPerMinute, 15);
    const durationMin = Math.max(15, band.endMinutes - band.startMinutes);
    const newDurationMin = Math.max(15, durationMin + deltaMinutes);
    if (newDurationMin === durationMin) { resizeHeight.value = withSpring(0); return; }
    confirmResize(newDurationMin);
  }

  function confirmResize(newDurationMin: number) {
    if (!soleBooking) return;
    if (isSampleBooking(soleBooking.id)) {
      Alert.alert(i18n.t('calendar:timeline.sampleDataTitle'), i18n.t('calendar:timeline.sampleDataBlockResizeMessage'));
      resizeHeight.value = withSpring(0);
      return;
    }
    const newEnd = new Date(new Date(soleBooking.starts_at).getTime() + newDurationMin * 60000);
    const fmt = (d: Date) => formatTimeShortInTZ(d, timeZone);
    Alert.alert(
      i18n.t('calendar:timeline.changeBlockLength'),
      i18n.t('calendar:timeline.lengthChangeBlockDetail', { start: fmt(new Date(soleBooking.starts_at)), end: fmt(newEnd), minutes: newDurationMin }),
      [
        { text: i18n.t('calendar:timeline.cancel'), style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
        { text: i18n.t('calendar:timeline.save'), onPress: () => commitResize(newEnd, false) },
      ],
    );
  }

  async function commitResize(newEnd: Date, overrideConflict: boolean) {
    if (!soleBooking) return;
    setBusy(true);
    const result = await resizeBooking(soleBooking.id, newEnd.toISOString(), overrideConflict);
    setBusy(false);
    if (result.ok) { resizeHeight.value = withSpring(0); return; }
    if (result.code === 'CONFLICT' && !overrideConflict) {
      Alert.alert(
        i18n.t('calendar:timeline.appointmentsInsideRangeTitle'),
        i18n.t('calendar:timeline.appointmentsInsideRangeMessage'),
        [
          { text: i18n.t('calendar:timeline.cancel'), style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
          { text: i18n.t('calendar:timeline.extendAnyway'), onPress: () => commitResize(newEnd, true) },
        ],
      );
      return;
    }
    resizeHeight.value = withSpring(0);
    Alert.alert(i18n.t('calendar:timeline.couldNotChangeLength'), result.error);
  }

  const resizeDrag = Gesture.Pan()
    .onBegin(() => { resizing.value = true; })
    .onUpdate((e) => { resizeHeight.value = e.translationY; })
    .onEnd((e) => {
      resizing.value = false;
      runOnJS(finishResize)(e.translationY);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(18, height + (canResize ? resizeHeight.value : 0)),
    opacity: busy ? 0.6 : 1,
  }));
  const resizeHandleStyle = useAnimatedStyle(() => ({
    top: top + height + (canResize ? resizeHeight.value : 0) - 7,
  }));

  return (
    <>
      <GestureDetector gesture={tap}>
        <Animated.View style={[styles.blockBand, { top, width: rowWidth }, animatedStyle]} pointerEvents="auto">
          <BlockStripes />
        </Animated.View>
      </GestureDetector>
      {canResize && (
        <GestureDetector gesture={resizeDrag}>
          <Animated.View style={[styles.blockBandResizeZone, { width: rowWidth }, resizeHandleStyle]}>
            <View style={styles.blockBandResizeGrip} />
          </Animated.View>
        </GestureDetector>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  noStaffContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm,
  },
  noStaffTitle: { fontSize: 18, fontWeight: '700', color: P.textPrimary, textAlign: 'center', marginTop: Spacing.sm },
  noStaffSubtitle: { fontSize: 14, color: P.textSecondary, textAlign: 'center', maxWidth: 320 },
  noStaffButtonRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  noStaffButtonOutline: {
    paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: P.border,
  },
  noStaffButtonOutlineText: { fontSize: 14, fontWeight: '600', color: P.textPrimary },
  noStaffButtonFilled: {
    paddingHorizontal: Spacing.md, paddingVertical: 12, borderRadius: BorderRadius.full,
    backgroundColor: P.textPrimary,
  },
  noStaffButtonFilledText: { fontSize: 14, fontWeight: '600', color: P.background },
  pullIndicator: {
    position: 'absolute', top: 10, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  hourLabel: { position: 'absolute', fontSize: 12, fontWeight: '700', color: P.textSecondary, right: 6, width: TIME_GUTTER - 6, textAlign: 'right' },
  gridBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // Hour lines stronger, quarter-hour lines fainter -- was both the same
  // hue/weight, which read too flat to tell "top of the hour" apart from
  // "just a quarter-hour tick" at a glance.
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: P.textDisabled },
  gridLineMinor: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(46,41,66,0.25)' },
  closedBand: { position: 'absolute', left: 0, backgroundColor: 'rgba(120,120,135,0.16)' },
  nowLine: { position: 'absolute', left: 0, height: 2, backgroundColor: P.error, zIndex: 5 },
  nowBadge: {
    position: 'absolute', right: 0, minWidth: TIME_GUTTER - 4, alignItems: 'center',
    backgroundColor: P.error, borderRadius: BorderRadius.sm, paddingHorizontal: 5, paddingVertical: 3, zIndex: 6,
  },
  nowBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  nowButton: {
    position: 'absolute', bottom: 116, right: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: P.primaryPurple, borderRadius: BorderRadius.full, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: P.primaryPurple, shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 6,
  },
  nowButtonText: { fontSize: 12.5, fontWeight: '700', color: '#FFFFFF' },
  columnLabel: { fontSize: 11, fontWeight: '700', color: P.textSecondary, textAlign: 'center', paddingVertical: 4 },

  // ── Appointment card (Calendar 2.0 Part 10/12) ──────────────────────
  block: {
    position: 'absolute', left: 8, right: 8, backgroundColor: P.surface,
    borderRadius: BorderRadius.md, padding: 8,
    borderLeftWidth: 4, borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: P.border, borderRightColor: P.border, borderBottomColor: P.border,
    // Card pass Part 9 — was 'center': fine for a short card, but a 90-min
    // card is tall enough that centering its one row of content left it
    // looking like an empty card with a stray line floating in the
    // middle. Anchoring to the top keeps content readable at any duration
    // without needing a separate "long card" branch.
    overflow: 'hidden', flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    shadowColor: P.secondaryPurple, shadowRadius: 10, shadowOffset: { width: 0, height: 0 },
  },
  blockTerminal: { opacity: 0.7 },
  blockTimeCol: { width: 58 },
  blockTimeText: { fontSize: 11.5, fontWeight: '700', color: P.textPrimary },
  blockDurationText: { fontSize: 10, color: P.textSecondary, marginTop: 1 },
  blockAvatar: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  blockAvatarText: { fontSize: 12, fontWeight: '700' },
  blockNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Card pass Part 1 — bumped from 13/700 to 14/800: customer name is
  // meant to read as the strongest text on the card, stronger than time
  // (blockTimeText, 11.5/700) and service (blockMeta, 11/400).
  blockCustomer: { fontSize: 14, fontWeight: '800', color: P.textPrimary, flexShrink: 1 },
  blockMeta: { fontSize: 11, color: P.textSecondary, marginTop: 1 },
  serviceSegments: { marginTop: 1, gap: 1 },
  blockMetaSegment: { fontSize: 10.5, color: P.textSecondary },
  newChip: { backgroundColor: P.secondaryPurple + '33', borderRadius: BorderRadius.sm, paddingHorizontal: 4, paddingVertical: 1 },
  newChipText: { fontSize: 8, fontWeight: '800', color: P.secondaryPurple },
  blockRightCol: { alignItems: 'flex-end', gap: 2 },
  pill: { borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  pillText: { fontSize: 9, fontWeight: '800' },
  // Card polish pass — was 14/800, identical visual weight to blockCustomer
  // (also 14/800), so price competed directly with customer name for
  // "strongest text on the card". Stepped down one notch (13/700) --
  // still easy to scan at a glance, no longer tied for top billing.
  priceText: { fontSize: 13, fontWeight: '700', color: P.textPrimary },
  cornerIconWrap: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.25)',
  },

  // ── Narrow/overlap card variant (Part 10) ──────────────────────────
  // Rule 10 — stacked and CENTERED (was flex-start), so a mini card with
  // only 1-2 lines of content (short-tier/minimal-tier) doesn't read as
  // pinned to the top of otherwise-empty space.
  narrowContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1, minWidth: 0, alignSelf: 'stretch' },
  // Short-narrow cleanup Part 3 — only the 'tall' tier ever draws a
  // resize grip below it, so only that tier needs this reserved bottom
  // gap; medium/short tiers have no grip to collide with.
  narrowContentTall: { paddingBottom: 8 },
  narrowTimeText: { fontSize: 8.5, fontWeight: '700', color: P.textPrimary },
  narrowNameText: { fontSize: 10, fontWeight: '800', color: P.textPrimary },
  narrowPriceText: { fontSize: 9.5, fontWeight: '800', color: P.textPrimary },
  cornerIconWrapSmall: {
    width: 13, height: 13, borderRadius: 6.5, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.25)', marginTop: 1,
  },

  // ── Resize handle (Part 19) — nearly invisible by default, a small grip
  // pill appears within the handle's own touch zone. ──────────────────
  resizeHandleZone: {
    // Explicit zIndex, higher than the card's own (which itself goes up to
    // 10 while dragging/resizing -- see animatedStyle) -- without this, a
    // sibling with no zIndex specified isn't guaranteed to paint/hit-test
    // above a sibling that does declare one, which would let the card's
    // own long-press-drag win touches in the region where the two
    // absolutely-positioned siblings overlap near the card's bottom edge.
    position: 'absolute', left: 8, right: 8, height: 22, alignItems: 'center', justifyContent: 'center', zIndex: 15,
  },
  resizeHandleGrip: {
    width: 28, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)',
  },
  // Mobile overlap fix — same touch target (resizeHandleZone, above,
  // still gets overlapStyle's full narrow width), a much smaller/fainter
  // grip so it doesn't visually crowd the mini card's own content.
  resizeHandleGripNarrow: { width: 14, height: 3, backgroundColor: 'rgba(255,255,255,0.14)' },
  // ── Blocked Time card (Part 26) ─────────────────────────────────────
  blockedCard: {
    position: 'absolute', left: 8, right: 8, backgroundColor: 'rgba(75,85,99,0.18)',
    borderRadius: BorderRadius.md, padding: 8, borderLeftWidth: 4, borderLeftColor: P.sourceBlock,
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(75,85,99,0.4)',
    overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  blockStripe: {
    position: 'absolute', top: -20, bottom: -20, width: 1, backgroundColor: 'rgba(255,255,255,0.05)',
    transform: [{ rotate: '20deg' }],
  },
  blockedTime: { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  blockedTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  blockedReason: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  blockedIconWrap: { padding: 4 },

  // ── Block Time background band (background-layer pass) ───────────────
  // Deliberately not card-shaped: no left accent border, no rounded avatar
  // row, spans the full timeline width rather than a slot. Dark
  // charcoal/muted-plum translucent fill (distinct from both the open
  // calendar background and every appointment source color) with the same
  // diagonal-stripe texture as before, but no text at all -- this layer
  // exists to read as "closed", not to explain why.
  blockBand: {
    position: 'absolute', left: 0, backgroundColor: 'rgba(58,42,66,0.34)',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'rgba(148,120,160,0.22)',
    overflow: 'hidden', zIndex: 1,
  },
  blockBandResizeZone: {
    position: 'absolute', left: 0, height: 20, alignItems: 'center', justifyContent: 'center', zIndex: 2,
  },
  blockBandResizeGrip: {
    width: 36, height: 2, borderRadius: 1, backgroundColor: 'rgba(148,120,160,0.4)',
  },

  openTapTarget: { position: 'absolute', left: 8, right: 8 },
});
