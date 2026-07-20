import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { Gesture, GestureDetector, Directions } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, runOnJS, withSpring,
} from 'react-native-reanimated';
import { OwnerBooking, updateBooking, checkIn, startService, completeService } from '@/lib/api/ownerBookings';
import { StaffMember } from '@/lib/api/ownerStaff';
import { bookingStatusColor, nextAction } from '@/lib/calendar/bookingStatus';
import { WeekSchedule, dayScheduleFor, gridBoundsMinutes, minutesSinceMidnight, hourLabels, snapMinutes } from '@/lib/calendar/timeGrid';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

const HOUR_HEIGHT_DEFAULT = 64; // px per 60 minutes at zoom = 1
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
  onOpenBooking: (b: OwnerBooking) => void;
  onChanged: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function TimelineCalendar({ date, bookings, staff, selectedStaffId, weekSchedule, onOpenBooking, onChanged, refreshing, onRefresh }: TimelineCalendarProps) {
  const zoom = useSharedValue(1);
  const [committedZoom, setCommittedZoom] = useState(1);

  const schedule = dayScheduleFor(weekSchedule, date);
  const { start: gridStart, end: gridEnd } = gridBoundsMinutes(schedule);
  const hourHeight = HOUR_HEIGHT_DEFAULT * committedZoom;
  const pxPerMinute = hourHeight / 60;
  const totalHeight = (gridEnd - gridStart) * pxPerMinute;

  const columns: Column[] = useMemo(() => {
    if (selectedStaffId !== 'all') {
      const s = staff.find(x => x.id === selectedStaffId);
      return [{ id: selectedStaffId, label: s?.name ?? 'Staff' }];
    }
    return [{ id: 'unassigned', label: 'Any Staff' }, ...staff.map(s => ({ id: s.id, label: s.name }))];
  }, [selectedStaffId, staff]);

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

  const labels = hourLabels(gridStart, gridEnd);
  const isToday = new Date().toDateString() === date.toDateString();

  return (
    <GestureDetector gesture={pinch}>
      <ScrollView
        contentContainerStyle={{ flexDirection: 'row' }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} /> : undefined
        }>
        {/* Time gutter */}
        <View style={{ width: TIME_GUTTER, height: totalHeight }}>
          {labels.map(l => (
            <Text key={l.minutes} style={[styles.hourLabel, { top: (l.minutes - gridStart) * pxPerMinute - 7 }]}>
              {l.label}
            </Text>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ height: totalHeight }}>
            {/* Gridlines */}
            <View style={styles.gridBackground}>
              {labels.map(l => (
                <View key={l.minutes} style={[styles.gridLine, { top: (l.minutes - gridStart) * pxPerMinute }]} />
              ))}
            </View>

            {/* Live "now" line */}
            {isToday && (() => {
              const nowMin = minutesSinceMidnight(new Date().toISOString());
              if (nowMin < gridStart || nowMin > gridEnd) return null;
              return <View style={[styles.nowLine, { top: (nowMin - gridStart) * pxPerMinute, width: columns.length * COLUMN_WIDTH }]} />;
            })()}

            <View style={{ flexDirection: 'row' }}>
              {columns.map((col, colIndex) => (
                <View key={col.id ?? 'all'} style={{ width: COLUMN_WIDTH, height: totalHeight, borderRightWidth: 1, borderRightColor: Colors.border }}>
                  {columns.length > 1 && <Text style={styles.columnLabel}>{col.label}</Text>}
                  {bookings.filter(b => columnForBooking(b) === colIndex).map(b => (
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
              ))}
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </GestureDetector>
  );
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
  const height = Math.max(28, durationMin * pxPerMinute);

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

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.block, { top: baseTop, height, borderLeftColor: color }, animatedStyle]}>
        <Text style={styles.blockCustomer} numberOfLines={1}>{booking.customer?.name ?? 'Customer'}</Text>
        {height > 40 && <Text style={styles.blockMeta} numberOfLines={1}>{booking.service?.name ?? 'Service'}</Text>}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hourLabel: { position: 'absolute', fontSize: 11, color: Colors.textSecondary, right: 6, width: TIME_GUTTER - 6, textAlign: 'right' },
  gridBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: Colors.border },
  nowLine: { position: 'absolute', left: 0, height: 2, backgroundColor: Colors.error, zIndex: 5 },
  columnLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center', paddingVertical: 4 },
  block: {
    position: 'absolute', left: 4, right: 4, backgroundColor: Colors.card,
    borderRadius: BorderRadius.sm, borderLeftWidth: 3, padding: 6, ...Shadows.subtle,
  },
  blockCustomer: { fontSize: 12.5, fontWeight: '700', color: Colors.textPrimary },
  blockMeta: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
});
