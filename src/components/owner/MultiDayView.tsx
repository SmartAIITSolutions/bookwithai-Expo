import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces, EmptySpace } from '@/lib/calendar/calendarInsights';
import { WeekSchedule, dayScheduleFor, gridBoundsMinutes, minutesSinceMidnight, hourLabels, localDateKey, snapMinutes } from '@/lib/calendar/timeGrid';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

interface MultiDayViewProps {
  startDate: Date;
  numDays: 3 | 7; // 3-Day and Week modes
  weekSchedule: WeekSchedule | null;
  selectedStaffId: string | 'all';
  onOpen: (b: OwnerBooking) => void;
  // Tapping empty grid space books for the exact tapped time -- when the
  // tapped day matches what's currently selected, `date` carries the real
  // time-of-day, not just midnight. `outsideHours` is true when the tap
  // landed in the closed-hours fringe (or a fully closed day) -- still
  // bookable, just flagged so the caller can warn no staff may be scheduled.
  onFillSlot: (date: Date, outsideHours?: boolean) => void;
  intervalMinutes?: 15 | 30 | 60;
}

const TIME_GUTTER = 40;
const HOUR_HEIGHT = 56;
const MIN_COLUMN_WIDTH = 100; // below this, a full-detail block can't fit -- 3-Day always gets at least this

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

interface Lane { booking: OwnerBooking; lane: number; laneCount: number }

// Groups bookings that overlap in time into lane clusters (like a real
// calendar app), so overlapping appointments for different staff sit
// side-by-side within the same day column instead of colliding.
function assignLanes(bookings: OwnerBooking[]): Lane[] {
  const sorted = [...bookings].sort((a, b) => minutesSinceMidnight(a.starts_at) - minutesSinceMidnight(b.starts_at));
  const active: { end: number; lane: number }[] = [];
  const placed: Lane[] = [];
  let group: Lane[] = [];

  function flushGroup() {
    if (group.length === 0) return;
    const laneCount = Math.max(...group.map(g => g.lane)) + 1;
    group.forEach(g => { g.laneCount = laneCount; placed.push(g); });
    group = [];
  }

  for (const b of sorted) {
    const start = minutesSinceMidnight(b.starts_at);
    const end = minutesSinceMidnight(b.ends_at);
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= start) active.splice(i, 1);
    }
    if (active.length === 0) flushGroup();
    const usedLanes = new Set(active.map(a => a.lane));
    let lane = 0;
    while (usedLanes.has(lane)) lane++;
    active.push({ end, lane });
    group.push({ booking: b, lane, laneCount: 1 });
  }
  flushGroup();
  return placed;
}

// 3-Day and Week modes — read-only side-by-side day columns, time-positioned
// like Day view but without drag/pinch (that complexity lives in the one
// mode meant for actually working the schedule); these are for glancing
// across days. Real "Open Slot" blocks are shown for gaps, not just booked
// appointments, matching the design spec. Week mode fits the full 7 days on
// screen at once (Option 3 in the reference mockup), so overlapping
// appointments (only possible with "All" staff selected, since one staff
// member can't double-book) collapse to initials-only capsules to fit.
export function MultiDayView({ startDate, numDays, weekSchedule, selectedStaffId, onOpen, onFillSlot, intervalMinutes = 60 }: MultiDayViewProps) {
  const [byDay, setByDay] = useState<Record<string, OwnerBooking[]>>({});
  const { width: screenWidth } = useWindowDimensions();

  const dates = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    Promise.all(dates.map(d => listBookingsForDate(localDateKey(d)))).then(results => {
      const map: Record<string, OwnerBooking[]> = {};
      results.forEach((r, i) => { if (r.ok) map[localDateKey(dates[i])] = r.data.data; });
      setByDay(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate.toDateString(), numDays]);

  // 3-Day gets a comfortable minimum width; Week (7 days) must fit the full
  // width with no horizontal scroll (Option 3), so it always divides evenly
  // regardless of how narrow that makes each column.
  const columnWidth = numDays === 7
    ? (screenWidth - TIME_GUTTER) / numDays
    : Math.max(MIN_COLUMN_WIDTH, (screenWidth - TIME_GUTTER) / numDays);

  // Shared grid bounds across all visible days (widest schedule wins) so
  // every column lines up against the same hour gutter.
  const schedules = dates.map(d => dayScheduleFor(weekSchedule, d));
  const bounds = schedules.map(gridBoundsMinutes);
  const gridStart = Math.min(...bounds.map(b => b.start));
  const gridEnd = Math.max(...bounds.map(b => b.end));
  // Scale height by the interval so a tick always keeps the same generous
  // tap size -- otherwise "15 min" would pack 4x as many ticks into the
  // same space, making them harder to tap precisely, not easier.
  const pxPerMinute = (HOUR_HEIGHT * (60 / intervalMinutes)) / 60;
  const totalHeight = (gridEnd - gridStart) * pxPerMinute;
  const labels = hourLabels(gridStart, gridEnd, intervalMinutes);
  const todayKey = localDateKey(new Date());

  const columnsContent = (
    <View style={{ flexDirection: 'row' }}>
      {dates.map((d, di) => {
        const key = localDateKey(d);
        const dayBookings = (byDay[key] ?? []).filter(b =>
          b.status !== 'cancelled' && (selectedStaffId === 'all' || b.staff_id === selectedStaffId)
        );
        const isClosed = schedules[di].open === false;
        const gaps = isClosed ? [] : findEmptySpaces(dayBookings, schedules[di], 30);
        const lanes = assignLanes(dayBookings);
        const isToday = key === todayKey;
        // This day's own closed-hours fringe, relative to the shared grid
        // bounds (which stretch to fit whichever day has the widest hours).
        // A fully closed day (e.g. Sunday) grays out its entire column
        // instead of just the usual before-opening/after-closing fringe.
        const closedTopHeight = isClosed ? totalHeight : Math.max(0, schedules[di].start * 60 - gridStart) * pxPerMinute;
        const closedBottomTop = Math.max(0, schedules[di].end * 60 - gridStart) * pxPerMinute;
        const closedBottomHeight = isClosed ? 0 : Math.max(0, gridEnd - schedules[di].end * 60) * pxPerMinute;
        return (
          <View key={key} style={[styles.column, { width: columnWidth }]}>
            <View style={styles.columnHeader}>
              <Text style={[styles.columnHeaderDow, isToday && styles.columnHeaderTextToday]}>
                {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
              </Text>
              <View style={[styles.dateBadge, isToday && styles.dateBadgeToday]}>
                <Text style={[styles.columnHeaderDate, isToday && styles.columnHeaderTextToday]}>{d.getDate()}</Text>
              </View>
            </View>
            <View style={{ height: totalHeight }}>
              <View style={styles.gridBackground}>
                {labels.map(l => (
                  <View key={l.minutes} style={[styles.gridLine, { top: (l.minutes - gridStart) * pxPerMinute }]} />
                ))}
              </View>

              {closedTopHeight > 0 && (
                <View style={[styles.closedBand, { top: 0, height: closedTopHeight, width: columnWidth }]} />
              )}
              {closedBottomHeight > 0 && (
                <View style={[styles.closedBand, { top: closedBottomTop, height: closedBottomHeight, width: columnWidth }]} />
              )}

              {gaps.filter(g => g.durationMinutes >= 30).map((g, gi) => (
                <OpenSlotBlock
                  key={gi}
                  gap={g}
                  gridStart={gridStart}
                  pxPerMinute={pxPerMinute}
                  onPressAt={(tappedMinutes) => {
                    const dayBase = new Date(d);
                    dayBase.setHours(0, 0, 0, 0);
                    onFillSlot(new Date(dayBase.getTime() + tappedMinutes * 60000));
                  }}
                />
              ))}
              {/* Closed-hours fringe (and fully closed days, via
                  closedTopHeight covering the whole grid) is still tappable
                  to book -- flagged via outsideHours so the caller can warn
                  no staff may actually be scheduled then. */}
              {closedTopHeight > 0 && (
                <ClosedSlotBlock
                  top={0}
                  height={closedTopHeight}
                  gridStart={gridStart}
                  pxPerMinute={pxPerMinute}
                  onPressAt={(tappedMinutes) => {
                    const dayBase = new Date(d);
                    dayBase.setHours(0, 0, 0, 0);
                    onFillSlot(new Date(dayBase.getTime() + tappedMinutes * 60000), true);
                  }}
                />
              )}
              {closedBottomHeight > 0 && (
                <ClosedSlotBlock
                  top={closedBottomTop}
                  height={closedBottomHeight}
                  gridStart={gridStart}
                  pxPerMinute={pxPerMinute}
                  onPressAt={(tappedMinutes) => {
                    const dayBase = new Date(d);
                    dayBase.setHours(0, 0, 0, 0);
                    onFillSlot(new Date(dayBase.getTime() + tappedMinutes * 60000), true);
                  }}
                />
              )}

              {lanes.map(({ booking: b, lane, laneCount }) => {
                const { color } = bookingStatusColor(b);
                const startMin = minutesSinceMidnight(b.starts_at);
                const endMin = minutesSinceMidnight(b.ends_at);
                const top = (startMin - gridStart) * pxPerMinute;
                const height = Math.max(28, (endMin - startMin) * pxPerMinute);
                const overlapping = laneCount > 1;

                if (overlapping) {
                  // Multiple staff double-booked the same slot ("All" view only,
                  // since a single staff member can't overlap themselves) --
                  // there isn't room for names, so collapse to an initials chip.
                  const laneWidth = (columnWidth - 6) / laneCount;
                  return (
                    <Pressable
                      key={b.id}
                      style={[
                        styles.overlapChip,
                        { top, height: Math.max(24, height), left: 3 + lane * laneWidth, width: laneWidth - 2, borderColor: color },
                      ]}
                      onPress={() => onOpen(b)}
                    >
                      <Text style={[styles.overlapChipText, { color }]} numberOfLines={1}>
                        {initials(b.customer?.name ?? '?')}
                      </Text>
                    </Pressable>
                  );
                }

                return (
                  <Pressable key={b.id} style={[styles.block, { top, height, borderLeftColor: color }]} onPress={() => onOpen(b)}>
                    <Text style={styles.time}>{new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
                    <Text style={styles.customer} numberOfLines={1}>{b.customer?.name ?? 'Customer'}</Text>
                    {height > 44 && <Text style={styles.service} numberOfLines={1}>{b.service?.name ?? 'Service'}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    // The owner tab bar floats over the bottom of the screen (absolute
    // position, ~66px + safe-area inset) -- without matching bottom
    // padding here, the last hour or two of the day render underneath it,
    // scrolled-to but invisible/untappable.
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: TIME_GUTTER, height: totalHeight + 40 }}>
          <View style={{ height: 40 }} />
          {/* Each day column's grid starts 40px down (after its own header
              row) -- these labels need that same 40px pushed in front of
              them via this wrapper, since `position: absolute` positions
              relative to THIS View's own top, not the page, and would
              otherwise ignore the spacer above and line up 40px too high
              against the actual gridlines/appointments. */}
          <View style={{ height: totalHeight }}>
            {labels.map(l => (
              <Text key={l.minutes} style={[styles.hourLabel, { top: (l.minutes - gridStart) * pxPerMinute - 6 }]}>{l.label}</Text>
            ))}
          </View>
        </View>

        {/* Week mode's columns are sized to fit the full width, so no
            horizontal scroll is needed (matches Option 3); 3-Day's wider
            columns still fit comfortably too since columnWidth is
            recomputed from numDays either way. */}
        {columnsContent}
      </View>
    </ScrollView>
  );
}

// Open/bookable time is left visually plain -- only the closed-hours
// fringe gets grayed out, so this is just an invisible tap target.
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
  hourLabel: { position: 'absolute', fontSize: 10.5, color: P.textDisabled, right: 6, width: TIME_GUTTER - 6, textAlign: 'right' },
  column: { borderRightWidth: 1, borderRightColor: P.border },
  columnHeader: { height: 40, alignItems: 'center', justifyContent: 'center', gap: 2 },
  columnHeaderDow: { fontSize: 10, fontWeight: '700', color: P.textDisabled, letterSpacing: 0.5 },
  dateBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dateBadgeToday: { backgroundColor: P.accentGold },
  columnHeaderDate: { fontSize: 13, fontWeight: '700', color: P.textPrimary },
  columnHeaderTextToday: { color: P.background },
  gridBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: P.border },
  closedBand: { position: 'absolute', left: 0, backgroundColor: 'rgba(120,120,135,0.16)' },
  block: {
    position: 'absolute', left: 3, right: 3, backgroundColor: P.card,
    borderRadius: BorderRadius.sm, borderLeftWidth: 3, padding: 5,
  },
  time: { fontSize: 9.5, color: P.textSecondary, fontWeight: '600' },
  customer: { fontSize: 11, fontWeight: '700', color: P.textPrimary, marginTop: 1 },
  service: { fontSize: 10, color: P.textSecondary, marginTop: 1 },
  overlapChip: {
    position: 'absolute', borderRadius: BorderRadius.sm, borderWidth: 1.5,
    backgroundColor: P.card, alignItems: 'center', justifyContent: 'center',
  },
  overlapChipText: { fontSize: 10, fontWeight: '800' },
  openTapTarget: { position: 'absolute', left: 3, right: 3 },
});
