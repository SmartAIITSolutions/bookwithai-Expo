import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { DollarSign, Check, X } from 'lucide-react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { CheckoutSheet, CheckoutSheetHandle } from '@/components/owner/CheckoutSheet';
import { WaitingQueue } from '@/components/owner/WaitingQueue';
import { BreathingHeart } from '@/components/BreathingHeart';
import { getDashboard, DashboardData } from '@/lib/api/ownerDashboard';
import { listBookingsForDate, getPaymentStatusForDate, getUpcomingActivity, getBooking, serviceDisplayName, OwnerBooking, PaymentStatusResult, UpcomingActivityItem } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces } from '@/lib/calendar/calendarInsights';
import { dayScheduleFor } from '@/lib/calendar/timeGrid';
import { groupBackToBackBookings } from '@/lib/calendar/groupBackToBack';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const THOUGHTS = [
  'A great salon day starts with one great appointment.',
  'Every returning client is a decision they made about you.',
  'Small consistency beats big effort every time.',
  'The chair is empty for a reason — fill it with intention.',
  'Today is data. Tomorrow is a decision.',
];

function greetingWord(hour: number) {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function money(cents: number) { return `$${(cents / 100).toFixed(0)}`; }

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Recent Activity can span any future date, not just today -- needs a real
// date alongside the time, not just "12:00 PM" with no day context.
function dateTimeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${dayLabel} · ${timeLabel(iso)}`;
}

// Compact paid/unpaid indicator -- a dollar sign with a small check or X
// badged over its corner, replacing a separate "Paid"/"Unpaid" text pill
// that duplicated the status pill next to it (paid already implies
// confirmed, so showing both was redundant).
function PaidIcon({ paid }: { paid: boolean }) {
  const color = paid ? '#4ADE80' : '#F09595';
  return (
    <View style={[styles.paidIconWrap, { borderColor: color }]}>
      <DollarSign size={14} color={color} strokeWidth={2.5} />
      <View style={[styles.paidIconOverlay, { backgroundColor: color }]}>
        {paid
          ? <Check size={8} color="#09000F" strokeWidth={3.5} />
          : <X size={8} color="#09000F" strokeWidth={3.5} />}
      </View>
    </View>
  );
}

// Multiple services booked back-to-back for the same customer (no gap
// between them) are one appointment, not one per service -- group before
// sorting so Today's Schedule shows one card per visit.
function todaysAppointmentGroups(bookings: OwnerBooking[]): OwnerBooking[][] {
  return groupBackToBackBookings(bookings.filter(b => b.status !== 'cancelled'));
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Phase 0.2 Dashboard — "answer 'Am I okay today?' in under 5 seconds."
export default function OwnerDashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [todaysBookings, setTodaysBookings] = useState<OwnerBooking[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);
  const checkoutRef = useRef<CheckoutSheetHandle>(null);

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const dayIndex = now.getDate() % THOUGHTS.length;

  const load = useCallback(async () => {
    const [dash, bookings, payment] = await Promise.all([
      getDashboard(),
      listBookingsForDate(todayKey),
      getPaymentStatusForDate(todayKey),
    ]);
    if (dash.ok) setData(dash.data);
    if (bookings.ok) setTodaysBookings(bookings.data.data);
    if (payment.ok) setPaymentStatus(payment.data);
    setLoading(false);
  }, [todayKey]);

  useEffect(() => { load(); }, [load]);

  function openBooking(b: OwnerBooking) {
    setSelectedBooking(b);
    sheetRef.current?.present();
  }

  // Recent Activity only carries a lightweight summary (not the full
  // OwnerBooking shape the Appointment Sheet needs), and its bookings
  // aren't necessarily in today's already-loaded list -- fetch the real
  // record on tap.
  async function openBookingById(id: string) {
    const result = await getBooking(id);
    if (result.ok) openBooking(result.data.data);
  }

  const healthColor = !data ? 'rgba(255,255,255,0.6)'
    : data.health.score >= 80 ? '#4ADE80'
    : data.health.score >= 50 ? '#FBBF24'
    : '#F09595';

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <View style={styles.container}>
      <OwnerScreenHeader title="Dashboard" onNotificationsPress={() => router.push('/owner-notifications' as never)} />
      {loading || !data ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Greeting */}
          <View>
            <Text style={styles.greeting}>{greetingWord(now.getHours())} 👋</Text>
            <Text style={styles.date}>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            <Text style={styles.thought}>{THOUGHTS[dayIndex]}</Text>
          </View>

          {/* Today's Snapshot — Health + Revenue + Appointments + Occupancy in one row */}
          <View style={styles.snapshotGrid}>
            <Pressable style={{ flex: 1 }} onPress={() => setHealthExpanded(v => !v)}>
              <BlurView intensity={90} tint="dark" style={[styles.snapshotCard, { borderColor: `${healthColor}88` }]}>
                <CardOverlay />
                <Text style={[styles.snapshotValue, { color: healthColor }]} numberOfLines={1} adjustsFontSizeToFit>{data.health.score}</Text>
                <Text style={styles.snapshotLabel} numberOfLines={1}>Health</Text>
              </BlurView>
            </Pressable>
            <SnapshotCard label="Revenue" value={money(data.snapshot.revenue_cents)} trend={data.snapshot.revenue_trend_pct} />
            <SnapshotCard label="Appointments" value={String(data.snapshot.appointments)} />
            <SnapshotCard label="Occupancy" value={`${data.snapshot.occupancy_pct}%`} />
          </View>
          {healthExpanded && (
            <View style={styles.healthReasons}>
              <Text style={styles.healthReasonsTitle}>{data.health.label}</Text>
              {data.health.reasons.map((r, i) => <Text key={i} style={styles.healthReasonText}>• {r}</Text>)}
            </View>
          )}

          {/* Waiting Queue */}
          <WaitingQueue bookings={todaysBookings} onOpen={openBooking} />

          {/* Today's Schedule — Option 2 card style, one card per visit */}
          {todaysBookings.length > 0 && (
            <View style={styles.scheduleSection}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {todaysAppointmentGroups(todaysBookings).map((group) => {
                const first = group[0];
                const status = bookingStatusColor(first);
                const paidValues = group.map(b => paymentStatus?.online_payment_enabled ? paymentStatus.statuses[b.id] : undefined);
                const paid = paidValues.some(p => p === undefined) ? undefined : paidValues.every(p => p === true);
                // Paid already implies confirmed -- showing both a Paid
                // icon and a "Confirmed" pill said the same thing twice.
                const showStatusBadge = !(paid === true && status.label === 'Confirmed');
                const amountCents = group.reduce((sum, b) => sum + (b.total_charged_cents || b.price_cents || 0), 0);
                const serviceLabel = group.map(serviceDisplayName).join(' + ');
                return (
                  <Pressable key={first.id} onPress={() => openBooking(first)}>
                    <BlurView intensity={90} tint="dark" style={styles.apptCard}>
                      <CardOverlay />
                      <View style={styles.apptAvatar}>
                        <Text style={styles.apptAvatarText}>{initials(first.customer?.name ?? '?')}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.apptName} numberOfLines={1}>{first.customer?.name ?? 'Customer'}</Text>
                        <Text style={styles.apptMeta} numberOfLines={1}>
                          {timeLabel(first.starts_at)}{first.staff?.name ? ` · ${first.staff.name}` : ''}
                        </Text>
                        <Text style={styles.apptService}>{serviceLabel}</Text>
                      </View>
                      <View style={styles.apptTrailing}>
                        <Text style={styles.apptAmount}>{money(amountCents)}</Text>
                        <View style={styles.apptTrailingIcons}>
                          {paid !== undefined && <PaidIcon paid={paid} />}
                          {showStatusBadge && (
                            <View style={[styles.statusBadge, { borderColor: status.color, backgroundColor: `${status.color}22` }]}>
                              <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </BlurView>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Recent Activity */}
          <RecentActivity bookings={todaysBookings} onOpen={openBookingById} />
        </ScrollView>
      )}
      <AppointmentSheet
        ref={sheetRef}
        booking={selectedBooking}
        onChanged={() => { sheetRef.current?.dismiss(); load(); }}
        onReadyForCheckout={() => checkoutRef.current?.present()}
      />
      <CheckoutSheet
        ref={checkoutRef}
        booking={selectedBooking}
        onDone={() => { checkoutRef.current?.dismiss(); sheetRef.current?.dismiss(); load(); }}
      />
      </View>
    </View>
  );
}

function SnapshotCard({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  return (
    <BlurView intensity={90} tint="dark" style={styles.snapshotCard}>
      <CardOverlay />
      <Text style={styles.snapshotValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {trend != null && <Text style={[styles.snapshotTrend, { color: trend >= 0 ? '#4ADE80' : '#F09595' }]}>{trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%</Text>}
      <Text style={styles.snapshotLabel} numberOfLines={1}>{label}</Text>
    </BlurView>
  );
}


function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statChip}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// Recent Activity — Option 5's stats-row idea (computed from today's real
// schedule, no extra fetch) plus a feed of upcoming appointments that had
// recent activity (new booking/reschedule/checkout/no-show), reframed
// around the appointment itself rather than raw notification text: customer
// name, service, amount, and a real Stripe-verified paid/unpaid flag. Only
// future, non-cancelled bookings show here -- past activity belongs to
// history, not to something still needing attention today.
function RecentActivity({ bookings, onOpen }: { bookings: OwnerBooking[]; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<UpcomingActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUpcomingActivity(6).then(r => {
      if (r.ok) setItems(r.data.data);
      setLoading(false);
    });
  }, []);

  const active = bookings.filter(b => b.status !== 'cancelled');
  // Back-to-back multi-service bookings for the same customer are one
  // appointment, not one per service -- count visits, not raw rows.
  const groups = todaysAppointmentGroups(bookings);
  const confirmedCount = groups.filter(g => !['completed', 'no_show'].includes(g[0].status)).length;
  const walkInCount = groups.filter(g => g.some(b => b.source === 'walk_in')).length;
  const openCount = findEmptySpaces(active, dayScheduleFor(null, new Date()), 20).length;

  return (
    <View style={styles.activitySection}>
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.statsRow}>
        <StatChip label="Total Appts" value={String(groups.length)} />
        <StatChip label="Confirmed" value={String(confirmedCount)} />
        <StatChip label="Open Slots" value={String(openCount)} />
        <StatChip label="Walk-Ins" value={String(walkInCount)} />
      </View>
      {loading ? (
        <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}><BreathingHeart size={22} color="#F4D77A" /></View>
      ) : items.length === 0 ? (
        <Text style={styles.activityEmpty}>No upcoming activity yet.</Text>
      ) : (
        <BlurView intensity={90} tint="dark" style={styles.activityCard}>
          <CardOverlay />
          {items.map((item, i) => (
            <Pressable key={item.booking_id} onPress={() => onOpen(item.booking_id)}>
              <View style={[styles.activityRow, i > 0 && styles.activityRowBorder]}>
                <View style={styles.apptAvatar}>
                  <Text style={styles.apptAvatarText}>{initials(item.customer_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{item.customer_name}</Text>
                  <Text style={styles.activityMeta} numberOfLines={1}>{dateTimeLabel(item.starts_at)}</Text>
                  <Text style={styles.activityBody}>
                    {item.service_names.length > 0 ? item.service_names.join(' + ') : 'Service'}
                  </Text>
                </View>
                <View style={styles.apptTrailing}>
                  <Text style={styles.apptAmount}>{money(item.amount_cents)}</Text>
                  {item.paid !== undefined && <PaidIcon paid={item.paid} />}
                </View>
              </View>
            </Pressable>
          ))}
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: 110 },

  greeting: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  date: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  thought: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginTop: 6 },

  healthReasons: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: Spacing.sm,
    gap: 4,
  },
  healthReasonsTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A', marginBottom: 2 },
  healthReasonText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },

  snapshotGrid: { flexDirection: 'row', flexWrap: 'nowrap', gap: Spacing.xs },
  snapshotCard: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  snapshotValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF', textAlign: 'center' },
  snapshotTrend: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, textAlign: 'center' },
  snapshotLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2, textAlign: 'center' },

  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#F4D77A',
    marginBottom: Spacing.xs,
  },

  scheduleSection: { gap: Spacing.sm },
  apptCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  apptAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  apptAvatarText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  apptName: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.base, color: '#FFFFFF' },
  apptMeta: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  apptService: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  apptTrailing: { alignItems: 'flex-end', gap: Spacing.xs },
  apptAmount: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.base, color: '#F4D77A' },
  apptTrailingIcons: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statusBadge: {
    borderRadius: 12, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8,
  },
  statusBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: 10.5 },

  paidIconWrap: {
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  paidIconOverlay: {
    position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#09000F',
  },

  activitySection: { gap: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statChip: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.sm,
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  statLabel: { fontFamily: FontFamily.sora, fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  activityCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md },
  activityRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  activityTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.base, color: '#FFFFFF' },
  activityMeta: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#F4D77A', marginTop: 2 },
  activityBody: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  activityEmpty: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: Spacing.md },
});
