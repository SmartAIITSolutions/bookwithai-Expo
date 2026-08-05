import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerBooking, checkIn, startService, completeService, serviceDisplayName } from '@/lib/api/ownerBookings';
import { isRebookNudgeBooking, REBOOK_NUDGE_COLOR } from '@/lib/calendar/bookingStatus';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { CalendarPalette as P } from '@/constants/CalendarPalette';

interface QueueFlowViewProps {
  bookings: OwnerBooking[];
  onOpen: (b: OwnerBooking) => void;
  onReadyForCheckout: (b: OwnerBooking) => void;
  onChanged: () => void;
  onAddWalkIn: () => void;
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

function waitMinutes(since: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60000));
}

// Live-list alternative to opening AppointmentSheet one client at a time --
// built for high-traffic salons where the owner needs "who's next / who's
// in a chair / who's ready to pay" at a glance, not four taps per client.
// Modeled directly on WaitingQueue.tsx's filter/sort/30s-tick pattern,
// generalized into three buckets instead of one.
export function QueueFlowView({ bookings, onOpen, onReadyForCheckout, onChanged, onAddWalkIn }: QueueFlowViewProps) {
  const [, forceTick] = useState(0);
  const [working, setWorking] = useState<string | null>(null);
  // Guards against re-firing the auto-check-in PATCH for the same booking
  // more than once while waiting for the parent's `bookings` prop to
  // refresh and reflect the change.
  const autoCheckedIn = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => forceTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto time-based check-in: the moment a confirmed booking's scheduled
  // time arrives, treat it as checked-in without requiring a tap -- a
  // high-traffic salon actively running this screen doesn't need to
  // manually confirm someone showed up on time. Deliberately client-side
  // only (no cron): this screen being open is exactly the condition under
  // which a salon is running a live queue.
  useEffect(() => {
    const now = Date.now();
    for (const b of bookings) {
      if (
        b.status === 'confirmed' &&
        !b.checked_in_at &&
        new Date(b.starts_at).getTime() <= now &&
        !autoCheckedIn.current.has(b.id)
      ) {
        autoCheckedIn.current.add(b.id);
        checkIn(b.id).then(result => { if (result.ok) onChanged(); });
      }
    }
  });

  async function runAction(id: string, fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    setWorking(id);
    const result = await fn(id);
    setWorking(null);
    if (result.ok) onChanged();
  }

  const active = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'no_show' && b.status !== 'completed');
  const waiting = active
    .filter(b => !b.service_started_at)
    .sort((a, b) => (b.customer?.priority ? 1 : 0) - (a.customer?.priority ? 1 : 0) || new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const inService = active.filter(b => b.service_started_at && !b.service_completed_at);
  const readyToPay = active.filter(b => b.service_completed_at);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.addWalkInButton} onPress={onAddWalkIn}>
        <Ionicons name="add" size={16} color="#09000F" />
        <Text style={styles.addWalkInText}>Add Walk-in</Text>
      </TouchableOpacity>

      <Bucket title="Waiting" color="#FBBF24" empty="Nobody waiting right now.">
        {waiting.map(b => (
          <Row
            key={b.id}
            booking={b}
            onPress={() => onOpen(b)}
            working={working === b.id}
            actionLabel={b.checked_in_at ? 'Start' : 'Check In'}
            onAction={() => runAction(b.id, b.checked_in_at ? startService : checkIn)}
            meta={b.checked_in_at ? `${waitMinutes(b.checked_in_at)}m waiting` : new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          />
        ))}
      </Bucket>

      <Bucket title="In Service" color="#B794F6" empty="Nobody in a chair right now.">
        {inService.map(b => (
          <Row
            key={b.id}
            booking={b}
            onPress={() => onOpen(b)}
            working={working === b.id}
            actionLabel="Done"
            onAction={() => runAction(b.id, completeService)}
            meta={`${waitMinutes(b.service_started_at!)}m elapsed`}
          />
        ))}
      </Bucket>

      <Bucket title="Ready to Pay" color="#4ADE80" empty="Nothing waiting on payment.">
        {readyToPay.map(b => (
          <Row
            key={b.id}
            booking={b}
            onPress={() => onOpen(b)}
            working={false}
            actionLabel="Charge"
            onAction={() => onReadyForCheckout(b)}
            meta={serviceDisplayName(b)}
          />
        ))}
      </Bucket>
    </ScrollView>
  );
}

function Bucket({ title, color, empty, children }: { title: string; color: string; empty: string; children: React.ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <BlurView intensity={90} tint="dark" style={styles.card}>
      <CardOverlay />
      <View style={styles.header}>
        <View style={[styles.liveDot, { backgroundColor: color }]} />
        <Text style={[styles.title, { color }]}>{title}</Text>
      </View>
      {hasRows ? children : <Text style={styles.emptyText}>{empty}</Text>}
    </BlurView>
  );
}

function Row({ booking, onPress, working, actionLabel, onAction, meta }: {
  booking: OwnerBooking; onPress: () => void; working: boolean; actionLabel: string; onAction: () => void; meta: string;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {booking.customer?.priority && <Ionicons name="star" size={12} color="#F4D77A" />}
          {isRebookNudgeBooking(booking) && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: REBOOK_NUDGE_COLOR }} />}
          <Text style={styles.name} numberOfLines={1}>{booking.customer?.name ?? 'Customer'}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>{meta}{booking.staff?.name ? `  ·  ${booking.staff.name}` : ''}</Text>
      </View>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={(e) => { e.stopPropagation(); onAction(); }}
        disabled={working}
      >
        <Text style={styles.actionButtonText}>{working ? '…' : actionLabel}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: P.background },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  addWalkInButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg, paddingVertical: 12,
  },
  addWalkInText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.sm },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: 4,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  title: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  emptyText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.4)', paddingVertical: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.12)',
  },
  name: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  meta: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  actionButton: {
    backgroundColor: '#F4D77A', borderRadius: BorderRadius.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  actionButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: 12.5 },
});
