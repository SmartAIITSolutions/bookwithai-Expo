import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface WaitingQueueProps {
  bookings: OwnerBooking[];
  onOpen: (b: OwnerBooking) => void;
}

// Expected wait — if the customer's assigned staff is currently mid-service,
// estimate remaining time from that booking's own duration. Real math from
// data already loaded, not a guess.
function expectedWaitMinutes(waitingBooking: OwnerBooking, allBookings: OwnerBooking[]): number | null {
  if (!waitingBooking.staff_id) return null;
  const inService = allBookings.find(b =>
    b.staff_id === waitingBooking.staff_id && b.service_started_at && !b.service_completed_at
  );
  if (!inService?.service?.duration_minutes) return null;
  const estFinish = new Date(inService.service_started_at!).getTime() + inService.service.duration_minutes * 60000;
  const remaining = Math.round((estFinish - Date.now()) / 60000);
  return remaining > 0 ? remaining : null;
}

// Phase 2 Waiting Experience — checked in, not yet started, with a live
// wait timer so nobody sits forgotten. Priority customers surface first.
export function WaitingQueue({ bookings, onOpen }: WaitingQueueProps) {
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  const waiting = bookings
    .filter(b => b.checked_in_at && !b.service_started_at && b.status !== 'cancelled')
    .sort((a, b) => (b.customer?.priority ? 1 : 0) - (a.customer?.priority ? 1 : 0));
  if (waiting.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Waiting</Text>
      {waiting.map(b => {
        const minutes = Math.max(0, Math.round((Date.now() - new Date(b.checked_in_at!).getTime()) / 60000));
        const expected = expectedWaitMinutes(b, bookings);
        return (
          <TouchableOpacity key={b.id} style={styles.row} onPress={() => onOpen(b)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {b.customer?.priority && <Ionicons name="star" size={13} color={Colors.gold} />}
              <Text style={styles.name}>{b.customer?.name ?? 'Customer'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.timer, minutes >= 10 && styles.timerLate]}>{minutes}m waiting</Text>
              {expected != null && <Text style={styles.expected}>~{expected}m more</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 4, ...Shadows.subtle },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: Colors.textSecondary, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  name: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600' },
  timer: { fontSize: 13, color: Colors.statusArrivingSoon, fontWeight: '700' },
  timerLate: { color: Colors.error },
  expected: { fontSize: 10.5, color: Colors.textSecondary },
});
