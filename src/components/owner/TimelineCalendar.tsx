import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, Directions, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withSpring, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { OwnerBooking, updateBooking, resizeBooking, checkIn, startService, completeService, serviceDisplayName, customerDisplayName } from '@/lib/api/ownerBookings';
import { StaffMember } from '@/lib/api/ownerStaff';
import { nextAction, isRebookNudgeBooking, REBOOK_NUDGE_COLOR } from '@/lib/calendar/bookingStatus';
import {
  WeekSchedule, dayScheduleFor, hourLabels, snapMinutes,
  zonedMinutesSinceMidnight, zonedDateKey, zonedClockLabel,
} from '@/lib/calendar/timeGrid';
import { isSampleBooking } from '@/lib/calendar/sampleDayFixture';
import {
  bookingSource, SOURCE_COLOR, primaryPill, cornerIcon,
  PAYMENT_COLOR, PAYMENT_LABEL,
} from '@/lib/calendar/appointmentVisual';
import { SanaaMark } from '@/components/SanaaMark';
import { BreathingHeart } from '@/components/BreathingHeart';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

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

// Density pass — was 64 (px per hour at zoom=1, interval=60m). At that
// scale a typical 9 AM–7 PM operating day (11h including the existing
// 30-min open/close padding -- gridBoundsMinutes) rendered ~700px tall
// before even accounting for the interval multiplier below, which made a
// 15-min-interval day (the persisted-per-business default once anyone
// picks it) 4x that -- ~2800px, only a couple hours fitting on screen at
// once, exactly the reported "too vertically zoomed-in" symptom. 44
// brings that same 11h span to ~480px -- close to a full phone screen's
// visible grid area at the default 1h interval, matching the reference's
// overview-first density, while MIN_ZOOM/MAX_ZOOM (unchanged) still give
// pinch-zoom the same relative range to compress further or zoom in for
// detail from this new baseline.
const HOUR_HEIGHT_DEFAULT = 44; // px per 60 minutes at zoom = 1
const COLUMN_WIDTH = 160;
const TIME_GUTTER = 52;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;
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
  // Swiping the empty grid background (not an appointment block, which has
  // its own drag gesture) pages a day forward/back, same direction
  // convention as a page-turn: swipe left to go to the next day.
  onSwipeDate?: (direction: 'prev' | 'next') => void;
  // Long-press-then-release-without-dragging on an occupied block --
  // intentional double-booking (availability-override, Sprint N).
  onOpenAnother?: (startsAt: Date, staffId: string | null) => void;
}

export function TimelineCalendar({ date, bookings, staff, selectedStaffId, weekSchedule, timeZone, onOpenBooking, onChanged, onFillSlot, intervalMinutes = 60, onSwipeDate, onOpenAnother }: TimelineCalendarProps) {
  const zoom = useSharedValue(1);
  const [committedZoom, setCommittedZoom] = useState(1);
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
  // Calendar 2.0 Part 8 — default to the salon's real operating range, not
  // a meaningless full 24h grid. Still expands to include any booking/
  // block that genuinely falls outside that range (a late add-on, an
  // early cleanup shift) rather than clipping it off screen.
  //
  // Density-pass follow-up — this used to be gridBoundsMinutes(schedule)'s
  // own 30-min padding, the same helper findEmptySpaces() uses for Smart
  // Gap detection. That's fine as a SCROLLABLE-RANGE floor/ceiling when the
  // grid renders tall (the old, less dense default), but once the density
  // pass shrank px-per-minute, a schedule-hours-sized grid became short
  // enough to fit near-entirely on one screen -- so that same 30-min edge,
  // previously reached only after real scrolling, became an immediately
  // obvious hard stop a few minutes past open/close, with no way to scroll
  // to an early/late hour that just doesn't happen to have a booking on
  // it. This is Day view's OWN scrollable-range padding, intentionally
  // wider and intentionally NOT gridBoundsMinutes -- reusing that shared
  // helper here would also have widened Smart Gap's own detection window
  // (and MonthView/dayKpis's, which call it too), none of which this pass
  // is allowed to touch. The initial scroll position (further below,
  // useEffect keyed on date/intervalMinutes) still targets salon-local
  // "now" or the schedule's own opening time, unchanged -- only how far
  // you can scroll past that changed.
  const DAY_SCROLL_PADDING_MIN = 180;
  const scheduleBounds = {
    start: Math.max(0, schedule.start * 60 - DAY_SCROLL_PADDING_MIN),
    end: Math.min(24 * 60, schedule.end * 60 + DAY_SCROLL_PADDING_MIN),
  };
  const bookingMinuteBounds = bookings.reduce(
    (acc, b) => {
      const s = zonedMinutesSinceMidnight(b.starts_at, timeZone);
      const e = zonedMinutesSinceMidnight(b.ends_at, timeZone);
      return { min: Math.min(acc.min, s), max: Math.max(acc.max, e) };
    },
    { min: scheduleBounds.start, max: scheduleBounds.end },
  );
  const gridStart = Math.max(0, Math.min(scheduleBounds.start, bookingMinuteBounds.min));
  const gridEnd = Math.min(24 * 60, Math.max(scheduleBounds.end, bookingMinuteBounds.max));
  // Scale height by the interval so a tick always keeps the same generous
  // tap size -- otherwise "15 min" would pack 4x as many ticks into the
  // same space, making them harder to tap precisely, not easier.
  const hourHeight = HOUR_HEIGHT_DEFAULT * committedZoom * (60 / intervalMinutes);
  const pxPerMinute = hourHeight / 60;
  const totalHeight = (gridEnd - gridStart) * pxPerMinute;

  // Calendar 2.0 Day View — always a single unified column, regardless of
  // staff selection. The reference contract shows one timeline with no
  // per-staff columns at all; the previous "All Staff" behavior (a
  // full-height column per staff member, "Any Staff" included) was a
  // pre-existing pattern carried over from before this screen's redesign,
  // and it visibly breaks the reference match -- confirmed live: a real
  // staff roster produces mostly-empty side-by-side columns instead of one
  // readable day, and overlapping appointments already have their own
  // reference-matching side-by-side layout via layoutOverlaps() (used
  // below) for genuinely simultaneous bookings, which is the reference's
  // actual mechanism for showing more than one appointment at once.
  // Trade-off, disclosed rather than silently dropped: this removes
  // drag-a-card-sideways-to-reassign-staff, which only existed in that
  // multi-column mode. Nothing in AppointmentSheet offers a staff-reassign
  // control today either, so that capability isn't available through any
  // path right now -- a real gap, not something this change newly creates,
  // but worth a follow-up.
  const columns: Column[] = useMemo(() => [{ id: 'all', label: 'All' }], []);
  const columnWidth = Math.max(COLUMN_WIDTH, screenWidth - TIME_GUTTER);

  function columnForBooking(_b: OwnerBooking): number {
    return 0;
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, committedZoom * e.scale));
      zoom.value = next;
    })
    .onEnd(() => {
      runOnJS(setCommittedZoom)(zoom.value);
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
  function handleEmptyTap(tappedMinutes: number, outsideHours: boolean) {
    if (!onFillSlot) return;
    const dayBase = new Date(date);
    dayBase.setHours(0, 0, 0, 0);
    const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
    onFillSlot(startsAt, null, outsideHours);
  }

  // Bug fix — tapping truly empty grid space (not a booking, not a Smart
  // Gap, not the closed-hours fringe) previously did nothing: there was no
  // tap handler at all for that area, only for the specific overlays above
  // it. e.y is relative to this GestureDetector's own view (the ScrollView's
  // un-scrolled viewport), so scrollY.value (tracked from onScroll) has to
  // be added back to get the true position within the scrolled content.
  const emptyTap = Gesture.Tap()
    .onEnd((e) => {
      const contentY = e.y + scrollY.value;
      const tappedMinutes = snapMinutesWorklet(gridStart + contentY / pxPerMinute);
      const outsideHours = schedule.open === false || tappedMinutes < schedule.start * 60 || tappedMinutes >= schedule.end * 60;
      runOnJS(handleEmptyTap)(tappedMinutes, outsideHours);
    })
    .simultaneousWithExternalGesture(scrollRef as never);
  const backgroundGesture = Gesture.Race(pinchWithScroll, swipeNextDayWithScroll, swipePrevDayWithScroll, pullGestureWithScroll, emptyTap);

  const labels = hourLabels(gridStart, gridEnd, intervalMinutes);
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
  // out the whole grid.
  const isClosedToday = schedule.open === false;
  const closedTopHeight = isClosedToday ? totalHeight : Math.max(0, schedule.start * 60 - gridStart) * pxPerMinute;
  const closedBottomTop = Math.max(0, schedule.end * 60 - gridStart) * pxPerMinute;
  const closedBottomHeight = isClosedToday ? 0 : Math.max(0, gridEnd - schedule.end * 60) * pxPerMinute;

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

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ height: totalHeight, width: rowWidth }}>
              {/* Gridlines */}
              <View style={styles.gridBackground}>
                {labels.map(l => (
                  <View key={l.minutes} style={[styles.gridLine, { top: (l.minutes - gridStart) * pxPerMinute }]} />
                ))}
              </View>

              {/* Closed-hours fringe (before opening / after closing) */}
              {closedTopHeight > 0 && (
                <View style={[styles.closedBand, { top: 0, height: closedTopHeight, width: rowWidth }]} />
              )}
              {closedBottomHeight > 0 && (
                <View style={[styles.closedBand, { top: closedBottomTop, height: closedBottomHeight, width: rowWidth }]} />
              )}

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
                  return (
                    <View key={col.id ?? 'all'} style={{ width: columnWidth, height: totalHeight, borderRightWidth: 1, borderRightColor: P.border }}>
                      {columns.length > 1 && <Text style={styles.columnLabel}>{col.label}</Text>}
                      {/* Closed-hours fringe (and fully closed days, via
                          closedTopHeight covering the whole grid) is still
                          tappable to book -- an owner may have a staff
                          member coming in early/late, or want to log a
                          walk-in on a day marked closed. `onFillSlot`'s
                          outsideHours flag lets the caller show a reminder
                          that no staff may actually be scheduled then. */}
                      {onFillSlot && closedTopHeight > 0 && (
                        <ClosedSlotBlock
                          top={0}
                          height={closedTopHeight}
                          gridStart={gridStart}
                          pxPerMinute={pxPerMinute}
                          onPressAt={(tappedMinutes) => {
                            const dayBase = new Date(date);
                            dayBase.setHours(0, 0, 0, 0);
                            const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
                            onFillSlot(startsAt, col.id === 'unassigned' ? null : col.id, true);
                          }}
                        />
                      )}
                      {onFillSlot && closedBottomHeight > 0 && (
                        <ClosedSlotBlock
                          top={closedBottomTop}
                          height={closedBottomHeight}
                          gridStart={gridStart}
                          pxPerMinute={pxPerMinute}
                          onPressAt={(tappedMinutes) => {
                            const dayBase = new Date(date);
                            dayBase.setHours(0, 0, 0, 0);
                            const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
                            onFillSlot(startsAt, col.id === 'unassigned' ? null : col.id, true);
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
            <Text style={styles.nowButtonText}>Now</Text>
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
          <Text style={{ color: P.textSecondary, textAlign: 'center' }}>Couldn't load the timeline.{'\n'}{this.state.error.message}</Text>
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
  const source = bookingSource(booking);
  const color = isRebookNudgeBooking(booking) ? REBOOK_NUDGE_COLOR
    : isBlockedTime ? P.sourceBlock
    : booking.status === 'cancelled' ? P.error
    : booking.status === 'no_show' ? P.error
    : SOURCE_COLOR[source];
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
      Alert.alert('Sample Data', 'This is a demo appointment for visual review only. Moving it here isn’t saved.');
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      return;
    }
    const dayBase = new Date(booking.starts_at);
    dayBase.setHours(0, 0, 0, 0);
    dayBase.setDate(dayBase.getDate() + dayOffset);
    const newStart = new Date(dayBase.getTime() + newStartMinutes * 60000);
    const dateLabel = newStart.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = newStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    Alert.alert(
      'Reschedule appointment?',
      `Move ${booking.customer ? customerDisplayName(booking) : 'this appointment'} to ${dateLabel} at ${timeLabel}?`,
      [
        {
          text: 'Ignore', style: 'cancel', onPress: () => {
            translateY.value = withSpring(0);
            translateX.value = withSpring(0);
          },
        },
        { text: 'Reschedule', onPress: () => commitMove(newStartMinutes, newColIndex, dayOffset) },
      ],
    );
  }

  async function commitMove(newStartMinutes: number, newColIndex: number, dayOffset: number, overrideConflict = false) {
    // Single-column now (see the `columns` comment above) -- a move only
    // ever changes time/day, never staff, since there's no longer a column
    // to drag a card into.
    const newStaffId = booking.staff_id;
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
        'Time slot is taken',
        `${booking.staff?.name ?? 'That staff member'} already has an appointment then. Double-book anyway?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { translateY.value = withSpring(0); translateX.value = withSpring(0); } },
          { text: 'Double-Book', style: 'destructive', onPress: () => commitMove(newStartMinutes, newColIndex, dayOffset, true) },
        ],
      );
      return;
    }

    translateY.value = withSpring(0);
    translateX.value = withSpring(0);
    Alert.alert('Could not move appointment', result.error);
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
      Alert.alert('Sample Data', 'This is a demo appointment for visual review only. Resizing it here isn’t saved.');
      resizeHeight.value = withSpring(0);
      return;
    }
    const newEnd = new Date(new Date(booking.starts_at).getTime() + newDurationMin * 60000);
    const startLabel = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(booking.starts_at));
    const endLabel = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(newEnd);
    Alert.alert(
      isBlockedTime ? 'Change block length?' : 'Change appointment length?',
      isBlockedTime
        ? `${startLabel} → ${endLabel} (${newDurationMin} min)?`
        : `${startLabel} → ${endLabel} (${newDurationMin} min) for ${customerDisplayName(booking)}?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
        { text: 'Save', onPress: () => commitResize(newEnd, false) },
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
        'Time slot is taken',
        'Extending this appointment would overlap another one. Double-book anyway?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
          { text: 'Double-Book', style: 'destructive', onPress: () => commitResize(newEnd, true) },
        ],
      );
      return;
    }
    resizeHeight.value = withSpring(0);
    Alert.alert('Could not change length', result.error);
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
      Alert.alert('Sample Data', 'This is a demo appointment for visual review only. Status actions here aren’t saved.');
      return;
    }
    setBusy(true);
    let result;
    if (direction === 'right') {
      // Swipe right = Check In (Phase 0.3)
      if (!action || action.label !== 'CHECK IN') { setBusy(false); return; }
      result = await checkIn(booking.id);
    } else {
      // Swipe left = advance toward checkout. Real Checkout Mode is Sprint 4 --
      // this advances the state machine as far as Sprint 2's own scope owns.
      if (action?.label === 'START SERVICE') result = await startService(booking.id);
      else if (action?.label === 'MARK SERVICE COMPLETE') result = await completeService(booking.id);
      else { setBusy(false); return; }
    }
    setBusy(false);
    if (result?.ok) onChanged();
    else if (result) Alert.alert('Could not update', result.error);
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
              {new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(booking.starts_at))}
              {' – '}
              {new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(booking.ends_at))}
              {'  ·  '}{durationMin}m
            </Text>
            <Text style={styles.blockedTitle} numberOfLines={1}>Blocked Time</Text>
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

  const timeLabel = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(booking.starts_at));
  // Short-narrow cleanup Part 2 — "10:55 AM" in an already-tight column
  // was reading as if two separate values were stacked. numberOfLines={1}
  // truncating a too-wide string still looks broken; dropping the AM/PM
  // suffix (spec explicitly allows this) keeps it a genuinely short,
  // single-token string that always fits one line at any narrow width.
  const narrowTimeLabel = timeLabel.replace(/\s?[AP]M$/i, '');

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
              <Text style={styles.narrowPriceText} numberOfLines={1}>${Math.round(booking.price_cents / 100)}</Text>
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
                  <View style={styles.newChip}><Text style={styles.newChipText}>NEW</Text></View>
                )}
              </View>
              {showMeta && (
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
                    {pill.kind === 'cancelled' ? 'CANCELLED' : pill.kind === 'no_show' ? 'NO-SHOW' : PAYMENT_LABEL[pill.badge]}
                  </Text>
                </View>
              )}
              {!isTerminal && !!booking.price_cents && (
                <Text style={styles.priceText}>${Math.round(booking.price_cents / 100)}</Text>
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
    const fmt = (d: string) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(d));
    Alert.alert(
      'Multiple Blocks Here',
      'This period has more than one blocked-time entry. Which one do you want to open?',
      [
        ...band.bookings.map(b => ({ text: `${fmt(b.starts_at)} – ${fmt(b.ends_at)}`, onPress: () => onOpenBooking(b) })),
        { text: 'Cancel', style: 'cancel' as const },
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
      Alert.alert('Sample Data', 'This is a demo block for visual review only. Resizing it here isn’t saved.');
      resizeHeight.value = withSpring(0);
      return;
    }
    const newEnd = new Date(new Date(soleBooking.starts_at).getTime() + newDurationMin * 60000);
    const fmt = (d: Date) => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(d);
    Alert.alert(
      'Change block length?',
      `${fmt(new Date(soleBooking.starts_at))} → ${fmt(newEnd)} (${newDurationMin} min)?`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
        { text: 'Save', onPress: () => commitResize(newEnd, false) },
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
        'Appointments Inside This Range',
        'Extending this block would newly overlap an appointment already on the calendar. That appointment is never touched -- extend anyway?',
        [
          { text: 'Cancel', style: 'cancel', onPress: () => { resizeHeight.value = withSpring(0); } },
          { text: 'Extend Anyway', onPress: () => commitResize(newEnd, true) },
        ],
      );
      return;
    }
    resizeHeight.value = withSpring(0);
    Alert.alert('Could not change length', result.error);
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
  pullIndicator: {
    position: 'absolute', top: 10, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  hourLabel: { position: 'absolute', fontSize: 12, fontWeight: '700', color: P.textSecondary, right: 6, width: TIME_GUTTER - 6, textAlign: 'right' },
  gridBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: P.border },
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
