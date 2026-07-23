import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withSpring,
} from 'react-native-reanimated';
import { OwnerBooking, updateBooking, checkIn, startService, completeService } from '@/lib/api/ownerBookings';
import { StaffMember } from '@/lib/api/ownerStaff';
import { bookingStatusColor, nextAction } from '@/lib/calendar/bookingStatus';
import { WeekSchedule, dayScheduleFor, minutesSinceMidnight, hourLabels, snapMinutes } from '@/lib/calendar/timeGrid';
import { findEmptySpaces, EmptySpace } from '@/lib/calendar/calendarInsights';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const HOUR_HEIGHT_DEFAULT = 64; // px per 60 minutes at zoom = 1
const COLUMN_WIDTH = 160;
const TIME_GUTTER = 52;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;
const RAIL_X = 14; // horizontal position of the connecting timeline rail within each column

interface Column { id: string | null; label: string }

interface TimelineCalendarProps {
  date: Date;
  bookings: OwnerBooking[];
  staff: StaffMember[];
  selectedStaffId: string | 'all';
  weekSchedule: WeekSchedule | null;
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
}

export function TimelineCalendar({ date, bookings, staff, selectedStaffId, weekSchedule, onOpenBooking, onChanged, onFillSlot, intervalMinutes = 60 }: TimelineCalendarProps) {
  const zoom = useSharedValue(1);
  const [committedZoom, setCommittedZoom] = useState(1);
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const schedule = dayScheduleFor(weekSchedule, date);
  // Full 24 hours, always -- hours outside business hours render as the
  // closed-hours gray band rather than being cut off, so switching staff/
  // days never hides a booking that happens to fall outside the normal
  // schedule (a late add-on, an early cleanup shift, etc.).
  const gridStart = 0;
  const gridEnd = 24 * 60;
  // Scale height by the interval so a tick always keeps the same generous
  // tap size -- otherwise "15 min" would pack 4x as many ticks into the
  // same space, making them harder to tap precisely, not easier.
  const hourHeight = HOUR_HEIGHT_DEFAULT * committedZoom * (60 / intervalMinutes);
  const pxPerMinute = hourHeight / 60;
  const totalHeight = (gridEnd - gridStart) * pxPerMinute;

  const columns: Column[] = useMemo(() => {
    if (selectedStaffId !== 'all') {
      const s = staff.find(x => x.id === selectedStaffId);
      return [{ id: selectedStaffId, label: s?.name ?? 'Staff' }];
    }
    return [{ id: 'unassigned', label: 'Any Staff' }, ...staff.map(s => ({ id: s.id, label: s.name }))];
  }, [selectedStaffId, staff]);

  // A single column (one staff selected, or "All" with only one real staff
  // member) should read like Option 1's full-width single-column timeline,
  // not a narrow fixed-width column meant for side-by-side comparison --
  // the fixed COLUMN_WIDTH only makes sense once there's more than one
  // column to actually compare.
  const columnWidth = columns.length <= 1 ? Math.max(COLUMN_WIDTH, screenWidth - TIME_GUTTER) : COLUMN_WIDTH;

  function columnForBooking(b: OwnerBooking): number {
    if (selectedStaffId !== 'all') return 0;
    if (!b.staff_id) return 0; // "Any Staff" column
    const idx = columns.findIndex(c => c.id === b.staff_id);
    return idx === -1 ? 0 : idx;
  }

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, committedZoom * e.scale));
      zoom.value = next;
    })
    .onEnd(() => {
      runOnJS(setCommittedZoom)(zoom.value);
    });

  const labels = hourLabels(gridStart, gridEnd, intervalMinutes);
  const isToday = new Date().toDateString() === date.toDateString();
  // Explicit width for the row of columns, since a horizontal ScrollView's
  // content container doesn't reliably infer it from nested content.
  const rowWidth = columns.length * columnWidth;

  // Land on the current time (today) or the day's opening time (other
  // days) instead of midnight -- with the full 24-hour grid, midnight is
  // rarely where anyone actually wants to start scrolling from. A little
  // lead-in above the target keeps some earlier context in view too.
  useEffect(() => {
    const targetMinutes = isToday ? minutesSinceMidnight(new Date().toISOString()) : schedule.start * 60;
    const leadInMinutes = 60;
    const y = Math.max(0, (targetMinutes - leadInMinutes - gridStart) * pxPerMinute);
    scrollRef.current?.scrollTo({ y, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date.toDateString(), intervalMinutes]);

  // Everything outside business hours (midnight to opening, closing to
  // midnight) gets a flat gray band. A fully closed day (e.g. Sunday) grays
  // out the whole grid.
  const isClosedToday = schedule.open === false;
  const closedTopHeight = isClosedToday ? totalHeight : Math.max(0, schedule.start * 60 - gridStart) * pxPerMinute;
  const closedBottomTop = Math.max(0, schedule.end * 60 - gridStart) * pxPerMinute;
  const closedBottomHeight = isClosedToday ? 0 : Math.max(0, gridEnd - schedule.end * 60) * pxPerMinute;

  return (
    <TimelineErrorBoundary>
    {/* No RefreshControl here -- three distinct configurations (direct on
        this ScrollView, with an explicit contentContainerStyle height, and
        nested inside an outer flexGrow ScrollView) all broke rendering of
        this absolute-positioned hour-grid content on this Android setup.
        MultiDayView has the identical grid pattern and simply never uses
        RefreshControl, which is why it's unaffected. Revisit only with a
        genuinely different mechanism (e.g. a custom Pan-gesture pull
        indicator that bypasses RefreshControl/SwipeRefreshLayout entirely)
        -- realtime updates via useOwnerBookings already cover new data
        appearing without a manual pull in the meantime. */}
    <GestureDetector gesture={pinch}>
      {/* The owner tab bar floats over the bottom of the screen (absolute
          position, ~66px + safe-area inset) -- without matching bottom
          padding here, the last hour or two of the 24-hour grid (and the
          live "now" line, whenever it's evening) render underneath it,
          scrolled-to but invisible/untappable. */}
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
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

              {/* Live "now" line */}
              {isToday && (() => {
                const nowMin = minutesSinceMidnight(new Date().toISOString());
                if (nowMin < gridStart || nowMin > gridEnd) return null;
                return <View style={[styles.nowLine, { top: (nowMin - gridStart) * pxPerMinute, width: rowWidth }]} />;
              })()}

              <View style={{ flexDirection: 'row' }}>
                {columns.map((col, colIndex) => {
                  const colBookings = bookings.filter(b => columnForBooking(b) === colIndex && b.status !== 'cancelled');
                  const gaps = onFillSlot && !isClosedToday ? findEmptySpaces(colBookings, schedule, 30) : [];
                  return (
                    <View key={col.id ?? 'all'} style={{ width: columnWidth, height: totalHeight, borderRightWidth: 1, borderRightColor: P.border }}>
                      {columns.length > 1 && <Text style={styles.columnLabel}>{col.label}</Text>}
                      {/* Timeline rail — a thin connecting line down the column,
                          matching the reference "Clean Timeline" design, with a
                          colored dot per item marking its start time. */}
                      <View style={styles.timelineRail} />
                      {gaps.filter(g => g.durationMinutes >= 30).map((g, gi) => (
                        <RailDot key={`gap-${gi}`} top={(g.startMinutes - gridStart) * pxPerMinute} color={P.accentGold} />
                      ))}
                      {colBookings.map(b => (
                        <RailDot key={`dot-${b.id}`} top={(minutesSinceMidnight(b.starts_at) - gridStart) * pxPerMinute} color={bookingStatusColor(b).color} />
                      ))}
                      {gaps.filter(g => g.durationMinutes >= 30).map((g, gi) => (
                        <OpenSlotBlock
                          key={gi}
                          gap={g}
                          gridStart={gridStart}
                          pxPerMinute={pxPerMinute}
                          onPressAt={(tappedMinutes) => {
                            const dayBase = new Date(date);
                            dayBase.setHours(0, 0, 0, 0);
                            const startsAt = new Date(dayBase.getTime() + tappedMinutes * 60000);
                            onFillSlot!(startsAt, col.id === 'unassigned' ? null : col.id);
                          }}
                        />
                      ))}
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
                      {colBookings.map(b => (
                        <AppointmentBlock
                          key={b.id}
                          booking={b}
                          gridStart={gridStart}
                          pxPerMinute={pxPerMinute}
                          columns={columns}
                          colIndex={colIndex}
                          onOpen={() => onOpenBooking(b)}
                          onChanged={onChanged}
                        />
                      ))}
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
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

function RailDot({ top, color }: { top: number; color: string }) {
  return <View style={[styles.railDot, { top: top - 3, backgroundColor: color }]} />;
}

function AppointmentBlock({
  booking, gridStart, pxPerMinute, columns, colIndex, onOpen, onChanged,
}: {
  booking: OwnerBooking; gridStart: number; pxPerMinute: number;
  columns: Column[]; colIndex: number; onOpen: () => void; onChanged: () => void;
}) {
  const startMin = minutesSinceMidnight(booking.starts_at);
  const endMin = minutesSinceMidnight(booking.ends_at);
  const durationMin = Math.max(15, endMin - startMin);
  const baseTop = (startMin - gridStart) * pxPerMinute;
  const height = Math.max(44, durationMin * pxPerMinute); // fits the avatar circle + padding without clipping

  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dragging = useSharedValue(false);
  const [busy, setBusy] = useState(false);

  const { color } = bookingStatusColor(booking);
  const action = nextAction(booking);

  async function commitMove(newStartMinutes: number, newColIndex: number) {
    const newStaffId = columns[newColIndex]?.id === 'unassigned' ? null : columns[newColIndex]?.id ?? booking.staff_id;
    const dayBase = new Date(booking.starts_at);
    dayBase.setHours(0, 0, 0, 0);
    const newStart = new Date(dayBase.getTime() + newStartMinutes * 60000);
    const newEnd = new Date(newStart.getTime() + durationMin * 60000);

    setBusy(true);
    const result = await updateBooking(booking.id, {
      starts_at: newStart.toISOString(),
      ends_at: newEnd.toISOString(),
      staff_id: newStaffId,
    });
    setBusy(false);

    if (result.ok) {
      onChanged();
    } else {
      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      Alert.alert('Could not move appointment', result.error);
    }
  }

  async function runSwipeAction(direction: 'left' | 'right') {
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
      translateX.value = columns.length > 1 ? e.translationX : 0;
    })
    .onEnd((e) => {
      dragging.value = false;
      const deltaMinutes = snapMinutes(e.translationY / pxPerMinute);
      const columnDelta = columns.length > 1 ? Math.round(e.translationX / COLUMN_WIDTH) : 0;
      const newColIndex = Math.min(columns.length - 1, Math.max(0, colIndex + columnDelta));
      const newStartMinutes = Math.max(0, startMin + deltaMinutes);

      translateY.value = withSpring(0);
      translateX.value = withSpring(0);
      if (deltaMinutes !== 0 || newColIndex !== colIndex) {
        runOnJS(commitMove)(newStartMinutes, newColIndex);
      }
    });

  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => runOnJS(runSwipeAction)('right'));
  const flingLeft  = Gesture.Fling().direction(Directions.LEFT).onEnd(() => runOnJS(runSwipeAction)('left'));
  const tap = Gesture.Tap().onEnd(() => runOnJS(onOpen)());

  const composed = Gesture.Race(flingLeft, flingRight, longPressDrag, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    zIndex: dragging.value ? 10 : 1,
    opacity: busy ? 0.6 : 1,
  }));

  const { label } = bookingStatusColor(booking);
  // Min block height is now 44 (room for the avatar row), so both fit at
  // the smallest size by default -- only hide the badge for a genuinely
  // long/zoomed-out compressed view where columns get crowded.
  const showMeta = true;
  const showBadge = height >= 44;

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.block, { top: baseTop, height }, animatedStyle]}>
        <View style={[styles.blockAvatar, { borderColor: color }]}>
          <Text style={[styles.blockAvatarText, { color }]}>{initials(booking.customer?.name ?? '?')}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.blockCustomer} numberOfLines={1}>{booking.customer?.name ?? 'Customer'}</Text>
          {showMeta && <Text style={styles.blockMeta} numberOfLines={1}>{booking.service?.name ?? 'Service'}</Text>}
        </View>
        {showBadge && (
          <View style={[styles.blockBadge, { backgroundColor: color + '26', borderColor: color }]}>
            <Text style={[styles.blockBadgeText, { color }]}>{label}</Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// Open/bookable time is left visually plain (no box, no pill) -- only the
// closed-hours fringe gets a gray treatment, so this is just an invisible
// tap target over the gap, same footprint the old boxed version used.
// Booking for "the exact time tapped" (not just the gap's start) means
// reading where inside this Pressable the tap landed and converting that
// back to minutes-since-midnight.
function OpenSlotBlock({ gap, gridStart, pxPerMinute, onPressAt }: {
  gap: EmptySpace; gridStart: number; pxPerMinute: number; onPressAt: (tappedMinutes: number) => void;
}) {
  const top = (gap.startMinutes - gridStart) * pxPerMinute;
  const height = Math.max(28, gap.durationMinutes * pxPerMinute);
  return (
    <Pressable
      style={[styles.openTapTarget, { top, height }]}
      onPress={(e) => {
        const offsetMinutes = snapMinutes(e.nativeEvent.locationY / pxPerMinute);
        const maxMinutes = gap.startMinutes + Math.max(0, gap.durationMinutes - 5);
        const tappedMinutes = Math.min(maxMinutes, Math.max(gap.startMinutes, gap.startMinutes + offsetMinutes));
        onPressAt(tappedMinutes);
      }}
    />
  );
}

// Same tap target as OpenSlotBlock, but spanning an arbitrary top/height
// range in column coordinates instead of a computed gap -- used for the
// closed-hours fringe, which is still tappable to book.
function ClosedSlotBlock({ top, height, gridStart, pxPerMinute, onPressAt }: {
  top: number; height: number; gridStart: number; pxPerMinute: number; onPressAt: (tappedMinutes: number) => void;
}) {
  return (
    <Pressable
      style={[styles.openTapTarget, { top, height }]}
      onPress={(e) => {
        const tappedMinutes = snapMinutes(gridStart + (top + e.nativeEvent.locationY) / pxPerMinute);
        onPressAt(tappedMinutes);
      }}
    />
  );
}

const styles = StyleSheet.create({
  hourLabel: { position: 'absolute', fontSize: 12, fontWeight: '700', color: P.textSecondary, right: 6, width: TIME_GUTTER - 6, textAlign: 'right' },
  gridBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: P.border },
  closedBand: { position: 'absolute', left: 0, backgroundColor: 'rgba(120,120,135,0.16)' },
  nowLine: { position: 'absolute', left: 0, height: 2, backgroundColor: P.error, zIndex: 5 },
  columnLabel: { fontSize: 11, fontWeight: '700', color: P.textSecondary, textAlign: 'center', paddingVertical: 4 },
  timelineRail: {
    position: 'absolute', left: RAIL_X, top: 0, bottom: 0, width: 2,
    backgroundColor: P.border,
  },
  railDot: {
    position: 'absolute', left: RAIL_X - 6, width: 14, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: P.background, zIndex: 2,
  },
  block: {
    position: 'absolute', left: RAIL_X + 10, right: 8, backgroundColor: P.surface,
    borderRadius: BorderRadius.md, padding: 8,
    borderWidth: 1, borderColor: P.border, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  blockAvatar: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.04)',
  },
  blockAvatarText: { fontSize: 10, fontWeight: '700' },
  blockCustomer: { fontSize: 12.5, fontWeight: '700', color: P.textPrimary },
  blockMeta: { fontSize: 11, color: P.textSecondary, marginTop: 1 },
  blockBadge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  blockBadgeText: { fontSize: 9.5, fontWeight: '700' },
  openTapTarget: { position: 'absolute', left: RAIL_X + 10, right: 8 },
});
