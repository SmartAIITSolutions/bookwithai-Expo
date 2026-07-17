import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { useOwnerBookings } from '@/lib/calendar/useOwnerBookings';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Day view (Phase 0.3 default). Simplified for Sprint 2: a time-sorted list
// with status coloring and staff filtering, rather than the full
// absolute-positioned hour-grid with drag/pinch gestures — those are a
// deliberate follow-up, not silently skipped. Tapping a card opens the
// Phase 0.4 appointment sheet.
export default function OwnerCalendarScreen() {
  const [date, setDate] = useState(new Date());
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const dateKey = toDateKey(date);
  const { bookings, loading, reload } = useOwnerBookings(dateKey);

  useEffect(() => {
    listStaff().then(result => { if (result.ok) setStaff(result.data.data.filter(s => s.active)); });
  }, []);

  function shiftDay(delta: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    setDate(next);
  }

  function openBooking(b: OwnerBooking) {
    setSelectedBooking(b);
    sheetRef.current?.present();
  }

  const handleChanged = useCallback(() => {
    sheetRef.current?.dismiss();
    reload();
  }, [reload]);

  const visibleBookings = selectedStaffId === 'all'
    ? bookings
    : bookings.filter(b => b.staff_id === selectedStaffId);

  const isToday = toDateKey(new Date()) === dateKey;

  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Calendar" />

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDay(-1)}><Text style={styles.dateNav}>← Yesterday</Text></TouchableOpacity>
        <Text style={styles.dateLabel}>{isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => shiftDay(1)}><Text style={styles.dateNav}>Tomorrow →</Text></TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffSelector} contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: Spacing.sm }}>
        <StaffChip label="All" active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} />
        {staff.map(s => (
          <StaffChip key={s.id} label={s.name} active={selectedStaffId === s.id} onPress={() => setSelectedStaffId(s.id)} />
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {visibleBookings.length === 0 && (
            <Text style={styles.emptyHint}>Nothing on the books for this day yet.</Text>
          )}
          {visibleBookings.map(b => {
            const { color } = bookingStatusColor(b);
            return (
              <TouchableOpacity key={b.id} style={[styles.card, { borderLeftColor: color }]} onPress={() => openBooking(b)}>
                <Text style={styles.cardTime}>
                  {new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
                <Text style={styles.cardCustomer}>{b.customer?.name ?? 'Customer'}</Text>
                <Text style={styles.cardMeta}>
                  {b.service?.name ?? 'Service'}{b.staff?.name ? ` · ${b.staff.name}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <AppointmentSheet ref={sheetRef} booking={selectedBooking} onChanged={handleChanged} />
    </View>
  );
}

function StaffChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
  },
  dateNav: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  dateLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  staffSelector: { flexGrow: 0, marginBottom: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: Colors.textOnPrimary },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing['2xl'] },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderLeftWidth: 4,
    padding: Spacing.md, ...Shadows.subtle,
  },
  cardTime: { fontSize: 12.5, color: Colors.textSecondary, fontWeight: '600' },
  cardCustomer: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  cardMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
