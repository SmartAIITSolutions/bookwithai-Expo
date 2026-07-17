import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { DaySchedule, gridBoundsMinutes, minutesSinceMidnight, hourLabels } from '@/lib/calendar/timeGrid';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

interface TimelineStripViewProps {
  bookings: OwnerBooking[];
  schedule: DaySchedule;
  onOpen: (b: OwnerBooking) => void;
}

const PX_PER_MIN = 3;

// The sixth mode — a compact single-row horizontal overview of the whole
// day at a glance, distinct from Day (per-staff grid) and Agenda (vertical
// list). Good for "what does today look like" without opening anything.
export function TimelineStripView({ bookings, schedule, onOpen }: TimelineStripViewProps) {
  const { start, end } = gridBoundsMinutes(schedule);
  const width = (end - start) * PX_PER_MIN;
  const labels = hourLabels(start, end);
  const active = bookings.filter(b => b.status !== 'cancelled');

  return (
    <ScrollView horizontal contentContainerStyle={{ padding: Spacing.lg }}>
      <View style={{ width, height: 80 }}>
        {labels.map(l => (
          <Text key={l.minutes} style={[styles.hourLabel, { left: (l.minutes - start) * PX_PER_MIN }]}>{l.label}</Text>
        ))}
        <View style={[styles.baseline, { width }]} />
        {active.map(b => {
          const { color } = bookingStatusColor(b);
          const left = (minutesSinceMidnight(b.starts_at) - start) * PX_PER_MIN;
          const w = Math.max(20, (minutesSinceMidnight(b.ends_at) - minutesSinceMidnight(b.starts_at)) * PX_PER_MIN);
          return (
            <TouchableOpacity key={b.id} style={[styles.block, { left, width: w, backgroundColor: color }]} onPress={() => onOpen(b)} />
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hourLabel: { position: 'absolute', top: 0, fontSize: 10, color: Colors.textSecondary },
  baseline: { position: 'absolute', top: 24, height: 1, backgroundColor: Colors.border },
  block: { position: 'absolute', top: 20, height: 10, borderRadius: 5 },
});
