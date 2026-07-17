import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { WalkInSheet } from '@/components/owner/WalkInSheet';
import { TimelineCalendar } from '@/components/owner/TimelineCalendar';
import { useOwnerBookings } from '@/lib/calendar/useOwnerBookings';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { getBusiness, Business } from '@/lib/api/ownerBusiness';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Spacing';

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Day view (Phase 0.3 default) — full hour-grid timeline with drag-to-move,
// pinch-to-zoom, and swipe (check-in / advance status) gestures, staff
// selector, and Walk-In. Tapping a card opens the Phase 0.4 appointment sheet.
export default function OwnerCalendarScreen() {
  const [date, setDate] = useState(new Date());
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | 'all'>('all');
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const walkInRef = useRef<BottomSheetModal>(null);

  const dateKey = toDateKey(date);
  const { bookings, loading, reload } = useOwnerBookings(dateKey);

  useEffect(() => {
    listStaff().then(result => { if (result.ok) setStaff(result.data.data.filter(s => s.active)); });
    getBusiness().then(result => { if (result.ok) setBusiness(result.data.business); });
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

  const handleWalkInBooked = useCallback(() => {
    walkInRef.current?.dismiss();
    reload();
  }, [reload]);

  const visibleBookings = selectedStaffId === 'all'
    ? bookings
    : bookings.filter(b => b.staff_id === selectedStaffId);

  const isToday = toDateKey(new Date()) === dateKey;

  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Calendar" onCreatePress={() => walkInRef.current?.present()} />

      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => shiftDay(-1)}><Text style={styles.dateNav}>← Yesterday</Text></TouchableOpacity>
        <Text style={styles.dateLabel}>{isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => shiftDay(1)}><Text style={styles.dateNav}>Tomorrow →</Text></TouchableOpacity>
      </View>

      <View style={styles.staffSelectorRow}>
        <StaffChip label="All" active={selectedStaffId === 'all'} onPress={() => setSelectedStaffId('all')} />
        {staff.map(s => (
          <StaffChip key={s.id} label={s.name} active={selectedStaffId === s.id} onPress={() => setSelectedStaffId(s.id)} />
        ))}
        <TouchableOpacity style={styles.walkInButton} onPress={() => walkInRef.current?.present()}>
          <Ionicons name="walk-outline" size={14} color={Colors.primary} />
          <Text style={styles.walkInText}>Walk-In</Text>
        </TouchableOpacity>
      </View>

      {loading || !business ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <TimelineCalendar
          date={date}
          bookings={visibleBookings}
          staff={staff}
          selectedStaffId={selectedStaffId}
          weekSchedule={business.week_schedule}
          onOpenBooking={openBooking}
          onChanged={reload}
        />
      )}

      <AppointmentSheet ref={sheetRef} booking={selectedBooking} onChanged={handleChanged} />
      <WalkInSheet ref={walkInRef} staff={staff} todaysBookings={bookings} onBooked={handleWalkInBooked} />
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
  staffSelectorRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: 999,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: Colors.textOnPrimary },
  walkInButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  walkInText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
});
