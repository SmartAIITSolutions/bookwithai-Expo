import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces, EmptySpace } from '@/lib/calendar/calendarInsights';
import { WeekSchedule, dayScheduleFor, gridBoundsMinutes, minutesSinceMidnight, hourLabels } from '@/lib/calendar/timeGrid';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

interface MultiDayViewProps {
  startDate: Date;
  numDays: 3 | 7; // 3-Day and Week modes
  weekSchedule: WeekSchedule | null;
  onOpen: (b: OwnerBooking) => void;
  onFillSlot: (date: Date) => void;
}

const TIME_GUTTER = 44;
const COLUMN_WIDTH = 130;
const HOUR_HEIGHT = 56;

// 3-Day and Week modes — read-only side-by-side day columns, time-positioned
// like Day view but without drag/pinch (that complexity lives in the one
// mode meant for actually working the schedule); these are for glancing
// across days. Real "Open Slot" blocks are shown for gaps, not just booked
// appointments, matching the design spec.
export function MultiDayView({ startDate, numDays, weekSchedule, onOpen, onFillSlot }: MultiDayViewProps) {
  const [byDay, setByDay] = useState<Record<string, OwnerBooking[]>>({});

  const dates = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  useEffect(() => {
    Promise.all(dates.map(d => listBookingsForDate(d.toISOString().slice(0, 10)))).then(results => {
      const map: Record<string, OwnerBooking[]> = {};
      results.forEach((r, i) => { if (r.ok) map[dates[i].toISOString().slice(0, 10)] = r.data.data; });
      setByDay(map);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate.toDateString(), numDays]);

  // Shared grid bounds across all visible days (widest schedule wins) so
  // every column lines up against the same hour gutter.
  const schedules = dates.map(d => dayScheduleFor(weekSchedule, d));
  const bounds = schedules.map(gridBoundsMinutes);
  const gridStart = Math.min(...bounds.map(b => b.start));
  const gridEnd = Math.max(...bounds.map(b => b.end));
  const pxPerMinute = HOUR_HEIGHT / 60;
  const totalHeight = (gridEnd - gridStart) * pxPerMinute;
  const labels = hourLabels(gridStart, gridEnd);
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <ScrollView style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: TIME_GUTTER, height: totalHeight + 40 }}>
          <View style={{ height: 40 }} />
          {labels.map(l => (
            <Text key={l.minutes} style={[styles.hourLabel, { top: (l.minutes - gridStart) * pxPerMinute - 6 }]}>{l.label}</Text>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row' }}>
            {dates.map((d, di) => {
              const key = d.toISOString().slice(0, 10);
              const bookings = (byDay[key] ?? []).filter(b => b.status !== 'cancelled');
              const gaps = findEmptySpaces(bookings, schedules[di], 30);
              const isToday = key === todayKey;
              return (
                <View key={key} style={styles.column}>
                  <View style={[styles.columnHeader, isToday && styles.columnHeaderToday]}>
                    <Text style={[styles.columnHeaderDow, isToday && styles.columnHeaderTextToday]}>
                      {d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                    </Text>
                    <Text style={[styles.columnHeaderDate, isToday && styles.columnHeaderTextToday]}>{d.getDate()}</Text>
                  </View>
                  <View style={{ height: totalHeight }}>
                    <View style={styles.gridBackground}>
                      {labels.map(l => (
                        <View key={l.minutes} style={[styles.gridLine, { top: (l.minutes - gridStart) * pxPerMinute }]} />
                      ))}
                    </View>

                    {gaps.filter(g => g.durationMinutes >= 30).map((g, gi) => (
                      <OpenSlotBlock key={gi} gap={g} gridStart={gridStart} pxPerMinute={pxPerMinute} onPress={() => onFillSlot(d)} />
                    ))}

                    {bookings.map(b => {
                      const { color } = bookingStatusColor(b);
                      const startMin = minutesSinceMidnight(b.starts_at);
                      const endMin = minutesSinceMidnight(b.ends_at);
                      const top = (startMin - gridStart) * pxPerMinute;
                      const height = Math.max(28, (endMin - startMin) * pxPerMinute);
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
        </ScrollView>
      </View>
    </ScrollView>
  );
}

function OpenSlotBlock({ gap, gridStart, pxPerMinute, onPress }: { gap: EmptySpace; gridStart: number; pxPerMinute: number; onPress: () => void }) {
  const top = (gap.startMinutes - gridStart) * pxPerMinute;
  const height = Math.max(28, gap.durationMinutes * pxPerMinute);
  return (
    <Pressable style={[styles.openBlock, { top, height }]} onPress={onPress}>
      <Ionicons name="add" size={13} color={P.accentGold} />
      <Text style={styles.openBlockText}>Open Slot</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hourLabel: { position: 'absolute', fontSize: 10.5, color: P.textDisabled, right: 6, width: TIME_GUTTER - 6, textAlign: 'right' },
  column: { width: COLUMN_WIDTH, borderRightWidth: 1, borderRightColor: P.border },
  columnHeader: { height: 40, alignItems: 'center', justifyContent: 'center' },
  columnHeaderToday: { backgroundColor: 'rgba(255,200,87,0.08)' },
  columnHeaderDow: { fontSize: 10.5, fontWeight: '700', color: P.textDisabled, letterSpacing: 0.5 },
  columnHeaderDate: { fontSize: 14, fontWeight: '700', color: P.textPrimary, marginTop: 1 },
  columnHeaderTextToday: { color: P.accentGold },
  gridBackground: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: P.border },
  block: {
    position: 'absolute', left: 4, right: 4, backgroundColor: P.card,
    borderRadius: BorderRadius.sm, borderLeftWidth: 3, padding: 6,
  },
  time: { fontSize: 10, color: P.textSecondary, fontWeight: '600' },
  customer: { fontSize: 12, fontWeight: '700', color: P.textPrimary, marginTop: 1 },
  service: { fontSize: 10.5, color: P.textSecondary, marginTop: 1 },
  openBlock: {
    position: 'absolute', left: 4, right: 4, borderRadius: BorderRadius.sm,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.accentGold,
    backgroundColor: 'rgba(255,200,87,0.06)', alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  openBlockText: { fontSize: 10, fontWeight: '700', color: P.accentGold },
});
