import { forwardRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { searchCustomers, quickCreateCustomer, CustomerLite } from '@/lib/api/ownerCustomers';
import { listServices, Service } from '@/lib/api/ownerServices';
import { createBooking, OwnerBooking } from '@/lib/api/ownerBookings';
import { StaffMember } from '@/lib/api/ownerStaff';
import { bookingStaffScopesConflictClient } from '@/lib/calendar/conflict';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface WalkInSheetProps {
  staff: StaffMember[];
  todaysBookings: OwnerBooking[];
  onBooked: () => void;
  // Set when a specific grid slot was tapped -- books for that exact time
  // instead of "earliest available now". `initialStaffId` follows the same
  // convention as the tap source: undefined = not specified (try every
  // staff member), null = a specific time but no specific staff (an
  // "any staff" column, or Week/3-Day's merged column), a string = that
  // exact staff member's own column was tapped.
  initialTime?: Date | null;
  initialStaffId?: string | null;
  // Set when the tapped slot falls outside the salon's normal open hours --
  // still bookable (an owner may have staff coming in early/late, or want
  // to log a walk-in on a day marked closed), but shown with a reminder
  // since there's no guarantee anyone is actually scheduled then.
  outsideBusinessHours?: boolean;
  // Set when arriving with a specific customer already in mind (e.g. the
  // "Book" action on a customer's profile) -- pre-selects them instead of
  // starting from an empty search, so the owner doesn't have to look the
  // same customer up again right after finding them.
  initialCustomer?: CustomerLite | null;
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Phase 0.3 Walk-in flow: pick/create a customer, pick a service, the
// earliest open chair is found automatically — "Walk-In → Find earliest
// chair → Book." Target ~15 seconds for a returning customer.
export const WalkInSheet = forwardRef<BottomSheetModal, WalkInSheetProps>(
  function WalkInSheet({ staff, todaysBookings, onBooked, initialTime, initialStaffId, outsideBusinessHours, initialCustomer }, ref) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<CustomerLite[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerLite | null>(null);

    useEffect(() => {
      if (initialCustomer) { setSelectedCustomer(initialCustomer); setQuery(initialCustomer.name); }
    }, [initialCustomer]);
    const [services, setServices] = useState<Service[]>([]);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [booking, setBooking] = useState(false);

    // New-customer form -- shown when a search comes back empty, since name,
    // phone, and email are all mandatory for every customer record (matches
    // the required-field gate on the mobile profile screen), not just name.
    const [addingNew, setAddingNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [creatingCustomer, setCreatingCustomer] = useState(false);

    useEffect(() => {
      listServices().then(r => { if (r.ok) setServices(r.data.data.filter(s => s.active)); });
    }, []);

    const runSearch = useCallback(async (q: string) => {
      setQuery(q);
      setSelectedCustomer(null);
      setAddingNew(false);
      if (q.trim().length < 2) { setResults([]); return; }
      const r = await searchCustomers(q.trim());
      if (r.ok) setResults(r.data.data);
    }, []);

    function startAddingNew() {
      setNewName(query.trim());
      setNewPhone('');
      setNewEmail('');
      setAddingNew(true);
    }

    async function handleAddCustomer() {
      if (!newName.trim() || !newPhone.trim() || !newEmail.trim()) {
        Alert.alert('All fields required', 'Name, phone, and email are all needed to add a new customer.');
        return;
      }
      setCreatingCustomer(true);
      const created = await quickCreateCustomer(newName.trim(), newPhone.trim(), newEmail.trim());
      setCreatingCustomer(false);
      if (!created.ok) { Alert.alert('Could not add customer', created.error); return; }
      setSelectedCustomer(created.data.data);
      setQuery(created.data.data.name);
      setResults([]);
      setAddingNew(false);
    }

    function findEarliestSlot(durationMin: number): { staffId: string | null; startsAt: Date } | null {
      const baseStart = initialTime
        ? new Date(initialTime)
        : new Date(Math.ceil(Date.now() / (5 * 60000)) * 5 * 60000);
      // A specific staff column was tapped -- only try that one, don't fall
      // back to whoever else happens to be free at that time.
      const candidates: (string | null)[] = initialStaffId !== undefined
        ? [initialStaffId]
        : staff.length > 0 ? staff.map(s => s.id) : [null];

      for (const staffId of candidates) {
        const start = new Date(baseStart);
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
      const customer = selectedCustomer;
      if (!customer) {
        Alert.alert('Pick or add a customer', 'Search for an existing customer or add a new one first.');
        return;
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
        setAddingNew(false); setNewName(''); setNewPhone(''); setNewEmail('');
        onBooked();
      } else if (result.error?.toLowerCase().includes('already booked')) {
        Alert.alert('Just got booked', 'That chair filled up — tap Book again to find the next one.');
      } else {
        Alert.alert('Could not book walk-in', result.error);
      }
    }

    const renderBackdrop = (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />;

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['70%']}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handleIndicator}
      >
        {/* Plain View, not BottomSheetView -- BottomSheetView's internal
            style is `position: absolute, top: 0`, meant for a single view
            that IS the whole sheet body, not a static header stacked above
            a separate scrollable. Using it here made this header (and
            anything inside it) float on top of BottomSheetScrollView's
            content instead of reserving space above it. */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Ionicons name="walk-outline" size={18} color="#F4D77A" />
            <View>
              <Text style={styles.title}>Walk-In</Text>
              <Text style={styles.subtitle}>
                {initialTime
                  ? `Booking for ${initialTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                  : 'Booking for the earliest available chair'}
              </Text>
            </View>
          </View>
          {outsideBusinessHours && (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#F4D77A" />
              <Text style={styles.warningText}>This time is outside normal hours — there may be no staff scheduled.</Text>
            </View>
          )}
        </View>
        <BottomSheetScrollView contentContainerStyle={styles.content}>
          <Text style={styles.label}>Customer</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by name, phone, or email"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={query}
            onChangeText={runSearch}
            editable={!addingNew}
          />
          {results.length > 0 && (
            <BlurView intensity={90} tint="dark" style={styles.resultsCard}>
              <CardOverlay />
              {results.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.resultRow, i > 0 && styles.resultRowBorder]}
                  onPress={() => { setSelectedCustomer(c); setQuery(c.name); setResults([]); }}
                >
                  <Text style={styles.resultText}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</Text>
                </TouchableOpacity>
              ))}
            </BlurView>
          )}
          {!selectedCustomer && !addingNew && query.trim().length >= 2 && results.length === 0 && (
            <TouchableOpacity style={styles.addNewRow} onPress={startAddingNew}>
              <Ionicons name="person-add-outline" size={16} color="#F4D77A" />
              <Text style={styles.newHint}>
                No match for "{query.trim()}" — <Text style={styles.newHintLink}>add new customer</Text>
              </Text>
            </TouchableOpacity>
          )}
          {addingNew && (
            <BlurView intensity={90} tint="dark" style={styles.newCustomerCard}>
              <CardOverlay />
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.input, { marginTop: Spacing.xs }]}
                placeholder="Phone number"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, { marginTop: Spacing.xs }]}
                placeholder="Email address"
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.newCustomerActions}>
                <TouchableOpacity style={styles.newCustomerCancel} onPress={() => setAddingNew(false)}>
                  <Text style={styles.newCustomerCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.newCustomerSave} onPress={handleAddCustomer} disabled={creatingCustomer}>
                  {creatingCustomer
                    ? <ActivityIndicator color="#09000F" />
                    : <Text style={styles.newCustomerSaveText}>Add customer</Text>}
                </TouchableOpacity>
              </View>
            </BlurView>
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
            {booking ? <ActivityIndicator color="#09000F" /> : <Text style={styles.bookButtonText}>Find chair & Book</Text>}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#0B0712', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl },
  handleIndicator: { backgroundColor: 'rgba(212,175,55,0.4)', width: 40 },
  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  subtitle: { fontFamily: FontFamily.sora, fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(244,215,122,0.12)', borderWidth: 1, borderColor: 'rgba(244,215,122,0.3)',
  },
  warningText: { flex: 1, fontFamily: FontFamily.sora, fontSize: 11, color: '#F4D77A' },
  content: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: Spacing['2xl'] },
  label: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, color: '#F4D77A', marginTop: Spacing.sm, marginBottom: 4,
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: Spacing.sm, paddingVertical: 10,
    fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF',
  },
  resultsCard: {
    borderRadius: BorderRadius.sm, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(0,0,0,0.2)', marginTop: 4,
  },
  resultRow: { paddingVertical: 10, paddingHorizontal: Spacing.sm },
  resultRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  resultText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  addNewRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  newHint: { flex: 1, fontFamily: FontFamily.sora, fontSize: 12.5, color: 'rgba(255,255,255,0.55)' },
  newHintLink: { fontFamily: FontFamily.soraSemiBold, color: '#6EA8FF', textDecorationLine: 'underline' },
  newCustomerCard: {
    borderRadius: BorderRadius.sm, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(0,0,0,0.2)',
    marginTop: 6, padding: Spacing.sm, gap: 0,
  },
  newCustomerActions: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  newCustomerCancel: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  newCustomerCancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },
  newCustomerSave: { flex: 2, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.sm, backgroundColor: '#F4D77A' },
  newCustomerSaveText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#09000F' },
  serviceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: BorderRadius.sm, padding: Spacing.sm, marginTop: 6,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  serviceRowActive: { borderWidth: 2, borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.08)' },
  serviceName: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  serviceMeta: { fontFamily: FontFamily.sora, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  bookButton: { backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg },
  bookButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.base },
});
