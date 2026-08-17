import { forwardRef, useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetFooter, type BottomSheetFooterProps } from '@gorhom/bottom-sheet';
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

function TimeStepper({ label, value, onChange, step = 1, pad }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; pad?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(value - step)}>
          <Ionicons name="remove" size={14} color="#F4D77A" />
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{pad ? String(value).padStart(2, '0') : value}</Text>
        <TouchableOpacity style={styles.stepperBtn} onPress={() => onChange(value + step)}>
          <Ionicons name="add" size={14} color="#F4D77A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface CartLine { service: Service; qty: number }

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
    // Tap-to-add cart, not single-select -- tapping a service again adds a
    // 2nd (or 3rd, ...) of it, since one walk-in often covers a whole
    // family/friend group getting the same thing.
    const [cart, setCart] = useState<CartLine[]>([]);
    const [booking, setBooking] = useState(false);

    // True walk-in with no name/phone/email at all -- a free-text label
    // stored directly on the booking instead of a real customer record, so
    // it never touches the mandatory-phone/email rule real customers have.
    const [walkInMode, setWalkInMode] = useState(false);
    const [walkInLabel, setWalkInLabel] = useState('');

    // Manual time+staff override (availability-override, Sprint N) -- lets
    // the owner pick ANY time/staff directly instead of only "earliest
    // available" or whatever exact slot was tapped. Time-of-day only; the
    // date always comes from initialTime (or "now" if the sheet was opened
    // generically), matching this sheet's existing single-day scope --
    // todaysBookings (used for the client-side conflict check below) is
    // only ever loaded for that one day.
    const [manualMode, setManualMode] = useState(false);
    const [manualHour12, setManualHour12] = useState(12);
    const [manualMinute, setManualMinute] = useState(0);
    const [manualAmPm, setManualAmPm] = useState<'AM' | 'PM'>('AM');
    const [manualStaffId, setManualStaffId] = useState<string | null>(null);

    useEffect(() => {
      const base = initialTime ?? new Date();
      const h = base.getHours() % 12;
      setManualHour12(h === 0 ? 12 : h);
      setManualMinute(Math.round(base.getMinutes() / 5) * 5 % 60);
      setManualAmPm(base.getHours() >= 12 ? 'PM' : 'AM');
      setManualStaffId(initialStaffId ?? null);
      setManualMode(false);
    }, [initialTime, initialStaffId]);

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

    function addToCart(service: Service) {
      setCart(prev => {
        const idx = prev.findIndex(l => l.service.id === service.id);
        if (idx === -1) return [...prev, { service, qty: 1 }];
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      });
    }

    function removeFromCart(serviceId: string) {
      setCart(prev => prev.flatMap(l => {
        if (l.service.id !== serviceId) return [l];
        return l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1 }];
      }));
    }

    const cartServiceIds = cart.flatMap(l => Array(l.qty).fill(l.service.id));
    const cartDurationMin = cart.reduce((s, l) => s + l.service.duration_minutes * l.qty, 0);
    const cartPriceCents = cart.reduce((s, l) => s + l.service.price_cents * l.qty, 0);
    const cartCount = cart.reduce((s, l) => s + l.qty, 0);

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

    function hasClientConflict(staffId: string | null, start: Date, end: Date) {
      return todaysBookings.some(b =>
        b.status !== 'cancelled' &&
        new Date(b.starts_at) < end && new Date(b.ends_at) > start &&
        bookingStaffScopesConflictClient(staffId, b.staff_id)
      );
    }

    function confirmDoubleBook(startsAt: Date, staffId: string | null) {
      const staffLabel = staffId ? (staff.find(s => s.id === staffId)?.name ?? 'That staff member') : 'Someone';
      const timeLabel = startsAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      Alert.alert(
        'Time slot is taken',
        `${staffLabel} already has an appointment at ${timeLabel}. Double-book anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Double-Book', style: 'destructive', onPress: () => handleBook(true) },
        ],
      );
    }

    async function handleBook(overrideConflict = false) {
      if (cart.length === 0) {
        Alert.alert('Pick a service', 'Choose what the walk-in is here for.');
        return;
      }
      const customer = selectedCustomer;
      // The label itself is optional -- walkInMode alone is enough to book
      // anonymously ("Walk-in" is the server's own default when none is
      // typed), same as walking in off the street with no name at all.
      const label = walkInMode ? walkInLabel.trim() : '';
      if (!customer && !walkInMode) {
        Alert.alert(
          'Pick a customer',
          'Search for an existing customer, add a new one, or switch to "Walk-in (no info)" below.'
        );
        return;
      }

      let staffId: string | null;
      let startsAt: Date;

      if (manualMode) {
        const hour24 = manualAmPm === 'PM' ? (manualHour12 % 12) + 12 : manualHour12 % 12;
        const dayBase = initialTime ? new Date(initialTime) : new Date();
        dayBase.setHours(hour24, manualMinute, 0, 0);
        startsAt = dayBase;
        staffId = manualStaffId;
      } else {
        const slot = findEarliestSlot(cartDurationMin);
        if (slot) {
          staffId = slot.staffId;
          startsAt = slot.startsAt;
        } else if (initialTime) {
          // Every candidate is busy -- but a specific time was targeted (a
          // tapped slot that got taken out from under this sheet, or the
          // long-press "book another here" entry point on an
          // already-occupied block), so fall back to exactly that
          // time/staff instead of a dead end. First time through, confirm
          // before proceeding; once confirmed (overrideConflict), actually
          // use that target for the booking below instead of re-hitting
          // this same "nothing free" wall a second time.
          if (!overrideConflict) {
            confirmDoubleBook(initialTime, initialStaffId ?? null);
            return;
          }
          staffId = initialStaffId ?? null;
          startsAt = initialTime;
        } else {
          setBooking(false);
          Alert.alert('No chair available', 'Every staff member is busy right now.');
          return;
        }
      }

      const endsAt = new Date(startsAt.getTime() + cartDurationMin * 60000);

      if (!overrideConflict && hasClientConflict(staffId, startsAt, endsAt)) {
        confirmDoubleBook(startsAt, staffId);
        return;
      }

      setBooking(true);
      const result = await createBooking({
        customer_id: customer?.id ?? null,
        // An empty label still has to reach the server as a non-empty
        // string -- otherwise it collapses to null there and looks
        // indistinguishable from "no customer, no walk-in intent at all",
        // failing the same required-field check meant to let this through.
        walk_in_label: customer ? null : (label || 'Walk-in'),
        service_ids: cartServiceIds,
        staff_id: staffId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        source: 'walk_in',
        override_conflict: overrideConflict || undefined,
      });
      setBooking(false);

      if (result.ok) {
        setQuery(''); setSelectedCustomer(null); setCart([]); setResults([]);
        setAddingNew(false); setNewName(''); setNewPhone(''); setNewEmail('');
        setWalkInMode(false); setWalkInLabel('');
        setManualMode(false);
        onBooked();
      } else if (result.code === 'CONFLICT' && !overrideConflict) {
        confirmDoubleBook(startsAt, staffId);
      } else if (result.error?.toLowerCase().includes('already booked')) {
        Alert.alert('Just got booked', 'That chair filled up — tap Book again to find the next one.');
      } else {
        Alert.alert('Could not book walk-in', result.error);
      }
    }

    const renderBackdrop = (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />;

    // Plain sibling Views after BottomSheetScrollView get clipped to the
    // sheet's snap-point-constrained content area instead of docking to
    // its actual bottom edge (the "Book" button was rendering half
    // offscreen) -- BottomSheetFooter is the library's own API for a
    // footer that stays pinned to the sheet's bottom regardless of snap
    // point or keyboard state.
    const renderFooter = useCallback((props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} style={styles.footer}>
        {cartCount > 0 && (
          <Text style={styles.footerSummary}>
            {cartCount} service{cartCount === 1 ? '' : 's'} · {cartDurationMin} min · ${(cartPriceCents / 100).toFixed(2)}
          </Text>
        )}
        <TouchableOpacity style={styles.bookButton} onPress={() => handleBook()} disabled={booking}>
          {booking
            ? <ActivityIndicator color="#09000F" />
            : <Text style={styles.bookButtonText}>{manualMode ? 'Book This Time' : 'Find chair & Book'}</Text>}
        </TouchableOpacity>
      </BottomSheetFooter>
      // eslint-disable-next-line react-hooks/exhaustive-deps
    ), [cartCount, cartDurationMin, cartPriceCents, booking, manualMode, cart, selectedCustomer, walkInMode, walkInLabel, manualHour12, manualMinute, manualAmPm, manualStaffId, initialTime, initialStaffId, staff, todaysBookings]);

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={['70%']}
        backdropComponent={renderBackdrop}
        footerComponent={renderFooter}
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
        <BottomSheetScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
          <Text style={styles.label}>Customer</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeChip, !walkInMode && styles.modeChipActive]}
              onPress={() => { setWalkInMode(false); setWalkInLabel(''); }}
            >
              <Text style={[styles.modeChipText, !walkInMode && styles.modeChipTextActive]}>Add customer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, walkInMode && styles.modeChipActive]}
              onPress={() => { setWalkInMode(true); setSelectedCustomer(null); setQuery(''); setResults([]); setAddingNew(false); }}
            >
              <Text style={[styles.modeChipText, walkInMode && styles.modeChipTextActive]}>Walk-in (no info)</Text>
            </TouchableOpacity>
          </View>

          {walkInMode ? (
            <TextInput
              style={[styles.input, { marginTop: 6 }]}
              placeholder={"Optional label, e.g. \"Sarah's sister\""}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={walkInLabel}
              onChangeText={setWalkInLabel}
            />
          ) : (
          <>
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
          </>
          )}

          <Text style={styles.label}>Service{cartCount > 0 ? ` (${cartCount})` : ''}</Text>
          {cart.length > 0 && (
            <View style={styles.cartCard}>
              {cart.map(line => (
                <View key={line.service.id} style={styles.cartLine}>
                  <Text style={styles.cartLineName} numberOfLines={1}>{line.service.name}</Text>
                  <View style={styles.cartLineControls}>
                    <TouchableOpacity style={styles.cartQtyBtn} onPress={() => removeFromCart(line.service.id)}>
                      <Ionicons name="remove" size={13} color="#F4D77A" />
                    </TouchableOpacity>
                    <Text style={styles.cartQtyText}>x{line.qty}</Text>
                    <TouchableOpacity style={styles.cartQtyBtn} onPress={() => addToCart(line.service)}>
                      <Ionicons name="add" size={13} color="#F4D77A" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
          {services.map(s => (
            <TouchableOpacity
              key={s.id}
              style={styles.serviceRow}
              onPress={() => addToCart(s)}
            >
              <Text style={styles.serviceName}>{s.name}</Text>
              <Text style={styles.serviceMeta}>{s.duration_minutes} min · ${(s.price_cents / 100).toFixed(2)}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.label}>Time & Staff</Text>
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[styles.modeChip, !manualMode && styles.modeChipActive]}
              onPress={() => setManualMode(false)}
            >
              <Text style={[styles.modeChipText, !manualMode && styles.modeChipTextActive]}>Earliest available</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeChip, manualMode && styles.modeChipActive]}
              onPress={() => setManualMode(true)}
            >
              <Text style={[styles.modeChipText, manualMode && styles.modeChipTextActive]}>Pick a time</Text>
            </TouchableOpacity>
          </View>

          {manualMode && (
            <View style={styles.manualPickerCard}>
              <View style={styles.timeStepperRow}>
                <TimeStepper
                  label="Hour"
                  value={manualHour12}
                  onChange={(v) => setManualHour12(((((v - 1) % 12) + 12) % 12) + 1)}
                />
                <Text style={styles.timeColon}>:</Text>
                <TimeStepper
                  label="Min"
                  value={manualMinute}
                  step={5}
                  pad
                  onChange={(v) => setManualMinute(((v % 60) + 60) % 60)}
                />
                <View style={styles.ampmToggle}>
                  {(['AM', 'PM'] as const).map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.ampmChip, manualAmPm === p && styles.ampmChipActive]}
                      onPress={() => setManualAmPm(p)}
                    >
                      <Text style={[styles.ampmChipText, manualAmPm === p && styles.ampmChipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={[styles.label, { marginTop: Spacing.sm }]}>Staff</Text>
              <View style={styles.staffChipRow}>
                <TouchableOpacity
                  style={[styles.staffChip, manualStaffId === null && styles.staffChipActive]}
                  onPress={() => setManualStaffId(null)}
                >
                  <Text style={[styles.staffChipText, manualStaffId === null && styles.staffChipTextActive]}>Unassigned</Text>
                </TouchableOpacity>
                {staff.map(s => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.staffChip, manualStaffId === s.id && styles.staffChipActive]}
                    onPress={() => setManualStaffId(s.id)}
                  >
                    <Text style={[styles.staffChipText, manualStaffId === s.id && styles.staffChipTextActive]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
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
  content: { padding: Spacing.lg, gap: Spacing.xs, paddingBottom: 110 },
  footer: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xl,
    borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)', backgroundColor: '#0B0712',
  },
  footerSummary: {
    textAlign: 'center', fontFamily: FontFamily.sora, fontSize: 12,
    color: 'rgba(255,255,255,0.6)', marginBottom: 8,
  },
  cartCard: {
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)', padding: Spacing.xs, marginTop: 6, gap: 4,
  },
  cartLine: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4, paddingHorizontal: 4,
  },
  cartLineName: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  cartLineControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cartQtyBtn: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  cartQtyText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A', minWidth: 20, textAlign: 'center' },
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
  serviceName: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  serviceMeta: { fontFamily: FontFamily.sora, fontSize: 12.5, color: 'rgba(255,255,255,0.65)' },
  bookButton: { backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center' },
  bookButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.base },
  modeToggleRow: { flexDirection: 'row', gap: Spacing.xs, marginTop: 4 },
  modeChip: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modeChipActive: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.12)' },
  modeChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12.5, color: 'rgba(255,255,255,0.6)' },
  modeChipTextActive: { color: '#F4D77A' },
  manualPickerCard: {
    marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', backgroundColor: 'rgba(0,0,0,0.15)',
  },
  timeStepperRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  timeColon: { fontFamily: FontFamily.soraSemiBold, fontSize: 18, color: '#FFFFFF', paddingBottom: 8 },
  stepper: { alignItems: 'center' },
  stepperLabel: { fontFamily: FontFamily.sora, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperBtn: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', backgroundColor: 'rgba(212,175,55,0.08)',
  },
  stepperValue: { fontFamily: FontFamily.soraSemiBold, fontSize: 16, color: '#FFFFFF', minWidth: 24, textAlign: 'center' },
  ampmToggle: { flexDirection: 'row', gap: 4, marginLeft: 4 },
  ampmChip: {
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  ampmChipActive: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.12)' },
  ampmChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' },
  ampmChipTextActive: { color: '#F4D77A' },
  staffChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  staffChip: {
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  staffChipActive: { borderColor: '#F4D77A', backgroundColor: 'rgba(212,175,55,0.12)' },
  staffChipText: { fontFamily: FontFamily.sora, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  staffChipTextActive: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },
});
