import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface MultiDayViewProps {
  startDate: Date;
  numDays: 3 | 7; // 3-Day and Week modes
  onOpen: (b: OwnerBooking) => void;
}

// 3-Day and Week modes — read-only side-by-side day columns. Deliberately
// simpler than Day view: no drag/pinch here (that complexity lives in the
// one mode meant for actually working the schedule); these are for
// glancing across days, tap a card to open it.
export function MultiDayView({ startDate, numDays, onOpen }: MultiDayViewProps) {
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

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {dates.map(d => {
        const key = d.toISOString().slice(0, 10);
        const bookings = (byDay[key] ?? []).filter(b => b.status !== 'cancelled')
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
        return (
          <View key={key} style={styles.column}>
            <Text style={styles.columnHeader}>{d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}</Text>
            <ScrollView contentContainerStyle={{ gap: 6, padding: 6 }}>
              {bookings.map(b => {
                const { color } = bookingStatusColor(b);
                return (
                  <TouchableOpacity key={b.id} style={[styles.card, { borderLeftColor: color }]} onPress={() => onOpen(b)}>
                    <Text style={styles.time}>{new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
                    <Text style={styles.customer} numberOfLines={1}>{b.customer?.name ?? 'Customer'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  column: { width: 150, borderRightWidth: 1, borderRightColor: Colors.border },
  columnHeader: { fontSize: 12.5, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center', paddingTop: Spacing.sm },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, borderLeftWidth: 3, padding: 8, ...Shadows.subtle },
  time: { fontSize: 10.5, color: Colors.textSecondary, fontWeight: '600' },
  customer: { fontSize: 12.5, color: Colors.textPrimary, fontWeight: '700', marginTop: 2 },
});
