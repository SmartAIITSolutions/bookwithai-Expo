import { forwardRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { searchCustomers, quickCreateCustomer, CustomerLite } from '@/lib/api/ownerCustomers';
import { listServices, Service } from '@/lib/api/ownerServices';
import { createBooking, OwnerBooking } from '@/lib/api/ownerBookings';
import { StaffMember } from '@/lib/api/ownerStaff';
import { bookingStaffScopesConflictClient } from '@/lib/calendar/conflict';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface WalkInSheetProps {
  staff: StaffMember[];
  todaysBookings: OwnerBooking[];
  onBooked: () => void;
}

// Phase 0.3 Walk-in flow: pick/create a customer, pick a service, the
// earliest open chair is found automatically — "Walk-In → Find earliest
// chair → Book." Target ~15 seconds for a returning customer.
export const WalkInSheet = forwardRef<BottomSheetModal, WalkInSheetProps>(
  function WalkInSheet({ staff, todaysBookings, onBooked }, ref) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CustomerLite[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerLite | null>(null);
    const [services, setServices] = useState<Service[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [booking, setBooking] = useState(false);

    useEffect(() => {
      listServices().then(r => { if (r.ok) setServices(r.data.data.filter(s => s.active)); });
    }, []);

    const runSearch = useCallback(async (q: string) => {
      setQuery(q);
      setSelectedCustomer(null);
      if (q.trim().length < 2) { setResults([]); return; }
      const r = await searchCustomers(q.trim());
      if (r.ok) setResults(r.data.data);
    }, []);

    function findEarliestSlot(durationMin: number): { staffId: string | null; startsAt: Date } | null {
      const now = new Date();
      const roundedNow = new Date(Math.ceil(now.getTime() / (5 * 60000)) * 5 * 60000);
      const candidates: (string | null)[] = staff.length > 0 ? staff.map(s => s.id) : [null];

      for (const staffId of candidates) {
        const start = new Date(roundedNow);
        const end = new Date(start.getTime() + durationMin * 60000);
        const conflict = todaysBookings.some(b =>
          b.status !== 'cancelled' &&
          new Date(b.starts_at) < end && new Date(b.ends_at) > start &&
          bookingStaffScopesConflictClient(staffId, b.staff_id)
        );
        if (!conflict) return { staffId, startsAt: start };
      }
      return null;
    }

    async function handleBook() {
      if (!selectedService) {
        Alert.alert('Pick a service', 'Choose what the walk-in is here for.');
        return;
      }
      let customer = selectedCustomer;
      if (!customer) {
        if (!query.trim()) { Alert.alert('Pick or add a customer', 'Search or add a new customer first.'); return; }
        setBooking(true);
        const created = await quickCreateCustomer(query.trim());
        if (!created.ok) { setBooking(false); Alert.alert('Could not add customer', created.error); return; }
        customer = created.data.data;
      }

      const slot = findEarliestSlot(selectedService.duration_minutes);
      if (!slot) {
        setBooking(false);
        Alert.alert('No chair available', 'Every staff member is busy right now.');
        return;
      }

      const endsAt = new Date(slot.startsAt.getTime() + selectedService.duration_minutes * 60000);
      setBooking(true);
      const result = await createBooking({
        customer_id: customer.id,
        service_id: selectedService.id,
        staff_id: slot.staffId,
        starts_at: slot.startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        source: 'walk_in',
      });
      setBooking(false);

      if (result.ok) {
        setQuery(''); setSelectedCustomer(null); setSelectedService(null); setResults([]);
        onBooked();
      } else if (result.error?.toLowerCase().includes('already booked')) {
        Alert.alert('Just got booked', 'That chair filled up — tap Book again to find the next one.');
      } else {
        Alert.alert('Could not book walk-in', result.error);
      }
    }

    const renderBackdrop = (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />;

    return (
      <BottomSheetModal ref={ref} snapPoints={['70%']} backdropComponent={renderBackdrop}>
        <BottomSheetView style={styles.header}>
          <Text style={styles.title}>Walk-In</Text>
        </BottomSheetView>
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Customer</Text>
          <TextInput
            style={styles.input}
            placeholder="Search or type a new name"
            placeholderTextColor={Colors.textDisabled}
            value={query}
            onChangeText={runSearch}
          />
          {results.map(c => (
            <TouchableOpacity key={c.id} style={styles.resultRow} onPress={() => { setSelectedCustomer(c); setQuery(c.name); setResults([]); }}>
              <Text style={styles.resultText}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</Text>
            </TouchableOpacity>
          ))}
          {!selectedCustomer && query.trim().length >= 2 && results.length === 0 && (
            <Text style={styles.newHint}>No match — "{query.trim()}" will be added as a new customer.</Text>
          )}

          <Text style={styles.label}>Service</Text>
          {services.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.serviceRow, selectedService?.id === s.id && styles.serviceRowActive]}
              onPress={() => setSelectedService(s)}
            >
              <Text style={styles.serviceName}>{s.name}</Text>
              <Text style={styles.serviceMeta}>{s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.bookButton} onPress={handleBook} disabled={booking}>
            {booking ? <ActivityIndicator color={Colors.textOnPrimary} /> : <Text style={styles.bookButtonText}>Find chair & Book</Text>}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  content: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: Spacing['2xl'] },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: Colors.textSecondary, marginTop: Spacing.sm },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 10, fontSize: 15, color: Colors.textPrimary,
  },
  resultRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  resultText: { fontSize: 14, color: Colors.textPrimary },
  newHint: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 4 },
  serviceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, marginTop: 6, ...Shadows.subtle,
  },
  serviceRowActive: { borderWidth: 2, borderColor: Colors.primary },
  serviceName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  serviceMeta: { fontSize: 12.5, color: Colors.textSecondary },
  bookButton: { backgroundColor: Colors.buttonPrimaryBg, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg, ...Shadows.button },
  bookButtonText: { color: Colors.buttonPrimaryText, fontSize: 15, fontWeight: '700' },
});
