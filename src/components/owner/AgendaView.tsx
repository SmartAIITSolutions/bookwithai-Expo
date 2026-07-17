import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface AgendaViewProps {
  bookings: OwnerBooking[];
  onOpen: (b: OwnerBooking) => void;
}

// One of Phase 0.3's six calendar modes — a plain time-sorted list.
export function AgendaView({ bookings, onOpen }: AgendaViewProps) {
  const sorted = [...bookings].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  return (
    <ScrollView contentContainerStyle={styles.list}>
      {sorted.length === 0 && <Text style={styles.emptyHint}>Nothing on the books for this day.</Text>}
      {sorted.map(b => {
        const { color } = bookingStatusColor(b);
        return (
          <TouchableOpacity key={b.id} style={[styles.row, { borderLeftColor: color }]} onPress={() => onOpen(b)}>
            <Text style={styles.time}>{new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.customer}>{b.customer?.name ?? 'Customer'}</Text>
              <Text style={styles.meta}>{b.service?.name ?? 'Service'}{b.staff?.name ? ` · ${b.staff.name}` : ''}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing['2xl'] },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg, borderLeftWidth: 4, padding: Spacing.md, ...Shadows.subtle,
  },
  time: { fontSize: 13, color: Colors.textSecondary, fontWeight: '700', width: 64 },
  customer: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  meta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
