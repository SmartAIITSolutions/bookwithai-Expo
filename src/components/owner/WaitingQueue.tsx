import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

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

// Amber wash instead of the app-wide purple/gold CardOverlay -- waiting
// customers are a "needs attention" state, so this card is deliberately
// styled to stand out from the neutral gold-bordered cards around it,
// while still using the same dark-glass BlurView language as the rest of
// the dashboard rather than looking like a leftover light-theme component.
function WaitingOverlay() {
  return (
    <LinearGradient
      colors={['rgba(251,191,36,0.14)', 'rgba(251,191,36,0.03)']}
      style={StyleSheet.absoluteFill}
    />
  );
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
    <BlurView intensity={90} tint="dark" style={styles.card}>
      <WaitingOverlay />
      <View style={styles.header}>
        <View style={styles.liveDot} />
        <Text style={styles.title}>Waiting</Text>
      </View>
      {waiting.map((b, i) => {
        const minutes = Math.max(0, Math.round((Date.now() - new Date(b.checked_in_at!).getTime()) / 60000));
        const expected = expectedWaitMinutes(b, bookings);
        return (
          <TouchableOpacity key={b.id} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => onOpen(b)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {b.customer?.priority && <Ionicons name="star" size={13} color="#F4D77A" />}
              <Text style={styles.name}>{b.customer?.name ?? 'Customer'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.timer, minutes >= 10 && styles.timerLate]}>{minutes}m waiting</Text>
              {expected != null && <Text style={styles.expected}>~{expected}m more</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(251,191,36,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.md,
    gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FBBF24' },
  title: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 0.6, color: '#FBBF24',
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(251,191,36,0.15)' },
  name: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  timer: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FBBF24' },
  timerLate: { color: '#F09595' },
  expected: { fontFamily: FontFamily.sora, fontSize: 10.5, color: 'rgba(255,255,255,0.5)' },
});
