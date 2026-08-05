import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Linking } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { getBooking, updateBooking, OwnerBooking, serviceDisplayName } from '@/lib/api/ownerBookings';
import { getCustomer, addNote, pinNote, deleteNote, CustomerNote } from '@/lib/api/ownerCustomers';
import { listStaff, StaffMember } from '@/lib/api/ownerStaff';
import { listServices, Service } from '@/lib/api/ownerServices';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { RebookDateTimeModal } from '@/components/owner/RebookDateTimeModal';
import { useAuth } from '@/lib/auth/AuthContext';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <BlurView intensity={90} tint="dark" style={styles.section}>
      <CardOverlay />
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </BlurView>
  );
}

// Full appointment editor -- reached by tapping the customer's name on
// AppointmentSheet's quick-view popup (Dashboard or Calendar). The popup
// itself only has room for status actions (check-in/no-show/cancel/etc.);
// this screen is where reschedule, service changes, staff reassignment,
// direct contact, and notes all live in one place.
export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { clientId } = useAuth();
  const [booking, setBooking] = useState<OwnerBooking | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const noteInputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [bookingResult, servicesResult] = await Promise.all([getBooking(id), listServices()]);
    if (bookingResult.ok) {
      const b = bookingResult.data.data;
      setBooking(b);
      setInternalNote(b.internal_notes ?? '');
      if (b.customer_id) {
        const customerResult = await getCustomer(b.customer_id);
        if (customerResult.ok) setNotes(customerResult.data.notes);
      }
    }
    // Kept unfiltered -- a since-deactivated service must still resolve its
    // name/price/duration for a booking that already has it attached. Only
    // the "Add service" picker itself should be limited to active ones.
    if (servicesResult.ok) setServices(servicesResult.data.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { listStaff().then(r => { if (r.ok) setStaff(r.data.data.filter(s => s.active)); }); }, []);

  async function patch(body: Parameters<typeof updateBooking>[1], onDone?: () => void) {
    if (!id) return;
    setBusy(true);
    const result = await updateBooking(id, body);
    setBusy(false);
    if (result.ok) { onDone?.(); load(); }
    else Alert.alert('Could not update', result.error);
  }

  function handleReschedule(newStart: Date) {
    if (!booking) return;
    const durationMs = new Date(booking.ends_at).getTime() - new Date(booking.starts_at).getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);
    setShowReschedule(false);
    patch({ starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() });
  }

  const [serviceIds, setServiceIdsState] = useState<string[] | null>(null);
  useEffect(() => {
    if (!booking) return;
    const ids = booking.service_line_ids && booking.service_line_ids.length > 0
      ? booking.service_line_ids
      : booking.service_id ? [booking.service_id] : [];
    setServiceIdsState(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id]);

  function addService(s: Service) {
    if (!serviceIds) return;
    const next = [...serviceIds, s.id];
    setServiceIdsState(next);
    saveServices(next);
  }

  function removeService(serviceId: string) {
    if (!serviceIds || serviceIds.length <= 1) return; // always keep at least one
    const next = serviceIds.filter(sid => sid !== serviceId);
    setServiceIdsState(next);
    saveServices(next);
  }

  function saveServices(ids: string[]) {
    if (!booking) return;
    let totalPriceCents = 0;
    let totalDurationMinutes = 0;
    for (const sid of ids) {
      const svc = services.find(s => s.id === sid);
      totalPriceCents += svc?.price_cents ?? 0;
      totalDurationMinutes += svc?.duration_minutes ?? 0;
    }
    // Adding/removing a service must grow or shrink the actual booked
    // time block too -- leaving ends_at untouched meant an added service
    // silently had no room on the calendar at all (still showed as the
    // original, shorter appointment).
    const newEnds = new Date(new Date(booking.starts_at).getTime() + totalDurationMinutes * 60000);
    patch({
      service_line_ids: ids.length > 1 ? ids : null,
      price_cents: totalPriceCents,
      ends_at: newEnds.toISOString(),
    });
  }

  async function handleAddNote() {
    if (!booking?.customer_id || !newNote.trim()) return;
    const result = await addNote(booking.customer_id, newNote.trim());
    if (result.ok) { setNewNote(''); load(); }
    else Alert.alert('Could not add note', result.error);
  }

  async function handlePinNote(noteId: string, pinned: boolean) {
    if (!booking?.customer_id) return;
    const result = await pinNote(booking.customer_id, noteId, !pinned);
    if (result.ok) load();
  }

  async function handleDeleteNote(noteId: string) {
    if (!booking?.customer_id) return;
    const result = await deleteNote(booking.customer_id, noteId);
    if (result.ok) load();
  }

  function saveInternalNote() {
    patch({ internal_notes: internalNote.trim() || null }, () => Alert.alert('Saved', 'Internal note updated.'));
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <DualBreathingBackground />
        <Stack.Screen options={{ headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A', title: 'Appointment' }} />
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      </View>
    );
  }

  const { color, label } = bookingStatusColor(booking);
  const displayServiceName = serviceDisplayName(booking);
  const resolvedServices = (serviceIds ?? [])
    .map(sid => services.find(s => s.id === sid))
    .filter((s): s is Service => !!s);
  const pickableServices = services.filter(s => s.active && !(serviceIds ?? []).includes(s.id));

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <Stack.Screen options={{
        headerStyle: { backgroundColor: '#0B0712' }, headerTintColor: '#F4D77A',
        headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
        title: booking.customer?.name ?? 'Appointment',
      }} />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{booking.customer?.name ?? 'Customer'}</Text>
            <Text style={styles.meta}>
              {new Date(booking.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              {'  ·  '}{new Date(booking.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              {'  ·  '}{displayServiceName}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: color }]}>
            <Text style={styles.statusPillText}>{label}</Text>
          </View>
        </View>

        {/* Quick contact */}
        <View style={styles.contactRow}>
          <ContactAction
            icon="call-outline" label="Call"
            disabled={!booking.customer?.phone}
            onPress={() => booking.customer?.phone && Linking.openURL(`tel:${booking.customer.phone}`)}
          />
          <ContactAction
            icon="chatbubble-outline" label="Text"
            disabled={!booking.customer?.phone}
            onPress={() => booking.customer?.phone && Linking.openURL(`sms:${booking.customer.phone}`)}
          />
          <ContactAction
            icon="mail-outline" label="Email"
            disabled={!booking.customer?.email}
            onPress={() => booking.customer?.email && Linking.openURL(`mailto:${booking.customer.email}`)}
          />
        </View>

        {/* Date & Time */}
        <Section title="Date & Time">
          <TouchableOpacity style={styles.rowBetween} onPress={() => setShowReschedule(true)} disabled={busy}>
            <Text style={styles.rowValue}>
              {new Date(booking.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {'  at  '}
              {new Date(booking.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
            <Text style={styles.linkText}>Change</Text>
          </TouchableOpacity>
        </Section>

        {/* Staff */}
        <Section title="Staff">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {staff.map(s => (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, booking.staff_id === s.id && styles.chipActive]}
                onPress={() => booking.staff_id !== s.id && patch({ staff_id: s.id })}
                disabled={busy}
              >
                <Text style={[styles.chipText, booking.staff_id === s.id && styles.chipTextActive]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Section>

        {/* Services */}
        <Section title="Services">
          {resolvedServices.map(s => (
            <View key={s.id} style={styles.rowBetween}>
              <Text style={styles.rowValue}>{s.name} — {money(s.price_cents)}</Text>
              {resolvedServices.length > 1 && (
                <TouchableOpacity onPress={() => removeService(s.id)} disabled={busy}>
                  <Ionicons name="close" size={16} color="#F09595" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addRow} onPress={() => setShowServicePicker(v => !v)}>
            <Ionicons name="add-circle-outline" size={16} color="#F4D77A" />
            <Text style={styles.linkText}>Add service</Text>
          </TouchableOpacity>
          {showServicePicker && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {pickableServices.map(s => (
                <TouchableOpacity key={s.id} style={styles.chip} onPress={() => { addService(s); setShowServicePicker(false); }}>
                  <Text style={styles.chipText}>{s.name} · {money(s.price_cents)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </Section>

        {/* Client note (tied to the customer, not just this visit) */}
        <Section title="Client Note">
          {notes.map(n => (
            <View key={n.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteDate}>{new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TouchableOpacity onPress={() => handlePinNote(n.id, n.pinned)}>
                    <Ionicons name={n.pinned ? 'pin' : 'pin-outline'} size={14} color={n.pinned ? '#F4D77A' : 'rgba(255,255,255,0.5)'} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteNote(n.id)}>
                    <Ionicons name="trash-outline" size={14} color="#F09595" />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.noteBody}>{n.body}</Text>
            </View>
          ))}
          <View style={styles.addNoteRow}>
            <TextInput
              ref={noteInputRef}
              style={styles.noteInput}
              placeholder="Add a note..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={newNote}
              onChangeText={setNewNote}
              multiline
            />
            <TouchableOpacity onPress={handleAddNote}><Text style={styles.linkText}>Save</Text></TouchableOpacity>
          </View>
        </Section>

        {/* Internal staff note (tied to this booking only) */}
        <Section title="Internal Staff Note">
          <TextInput
            style={styles.internalInput}
            placeholder="Notes only your team can see..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={internalNote}
            onChangeText={setInternalNote}
            multiline
          />
          <TouchableOpacity style={styles.saveRow} onPress={saveInternalNote} disabled={busy}>
            <Text style={styles.linkText}>Save</Text>
          </TouchableOpacity>
        </Section>

      </ScrollView>

      {clientId && (
        <RebookDateTimeModal
          visible={showReschedule}
          initialDate={new Date(booking.starts_at)}
          salonId={clientId}
          serviceId={booking.service_id ?? null}
          staffId={booking.staff_id}
          onCancel={() => setShowReschedule(false)}
          onConfirm={handleReschedule}
        />
      )}
    </View>
  );
}

function ContactAction({ icon, label, onPress, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.contactAction, disabled && styles.contactActionDisabled]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={20} color={disabled ? 'rgba(255,255,255,0.3)' : '#F4D77A'} />
      <Text style={[styles.contactActionText, disabled && styles.contactActionTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  customerName: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  meta: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPillText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: 12 },

  contactRow: { flexDirection: 'row', gap: Spacing.sm },
  contactAction: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  contactActionDisabled: { opacity: 0.4 },
  contactActionText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12, color: '#F4D77A' },
  contactActionTextDisabled: { color: 'rgba(255,255,255,0.4)' },

  section: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, textTransform: 'uppercase',
    letterSpacing: 0.6, color: '#F4D77A',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowValue: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF', flex: 1 },
  linkText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
  },
  chipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  chipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12.5, color: '#FFFFFF' },
  chipTextActive: { color: '#09000F' },

  noteCard: {
    borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(0,0,0,0.15)', padding: Spacing.sm, gap: 4,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  noteDate: { fontFamily: FontFamily.soraSemiBold, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  noteBody: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  addNoteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  noteInput: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, fontFamily: FontFamily.sora, fontSize: FontSize.sm,
    color: '#FFFFFF', maxHeight: 80,
  },
  internalInput: {
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 8, fontFamily: FontFamily.sora, fontSize: FontSize.sm,
    color: '#FFFFFF', minHeight: 60, textAlignVertical: 'top',
  },
  saveRow: { alignItems: 'flex-end' },
});
