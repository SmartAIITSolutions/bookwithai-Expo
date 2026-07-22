import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
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
import { listBookingsForDate, getPaymentStatusForDate, OwnerBooking, PaymentStatusResult } from '@/lib/api/ownerBookings';
import { listNotifications, OwnerNotification } from '@/lib/api/ownerNotifications';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces } from '@/lib/calendar/calendarInsights';
import { dayScheduleFor } from '@/lib/calendar/timeGrid';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

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

function sortedTodaysBookings(bookings: OwnerBooking[]): OwnerBooking[] {
  return bookings
    .filter(b => b.status !== 'cancelled')
    .slice()
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
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

          {/* Business Health Score */}
          <Pressable onPress={() => setHealthExpanded(v => !v)}>
            <BlurView intensity={90} tint="dark" style={styles.healthCard}>
              <CardOverlay />
              <Text style={styles.healthLabel}>Business Health</Text>
              <Text style={[styles.healthScore, { color: healthColor }]}>{data.health.score}</Text>
              <Text style={styles.healthSub}>{data.health.label}</Text>
            </BlurView>
          </Pressable>
          {healthExpanded && (
            <View style={styles.healthReasons}>
              {data.health.reasons.map((r, i) => <Text key={i} style={styles.healthReasonText}>• {r}</Text>)}
            </View>
          )}

          {/* Waiting Queue */}
          <WaitingQueue bookings={todaysBookings} onOpen={openBooking} />

          {/* Today's Snapshot */}
          <View style={styles.snapshotGrid}>
            <SnapshotCard label="Revenue" value={money(data.snapshot.revenue_cents)} trend={data.snapshot.revenue_trend_pct} />
            <SnapshotCard label="Appointments" value={String(data.snapshot.appointments)} />
            <SnapshotCard label="Clients" value={String(data.snapshot.clients)} />
            <SnapshotCard label="Occupancy" value={`${data.snapshot.occupancy_pct}%`} />
          </View>

          {/* Today's Schedule — Option 2 card style, appointments only */}
          {todaysBookings.length > 0 && (
            <View style={styles.scheduleSection}>
              <Text style={styles.sectionTitle}>Today's Schedule</Text>
              {sortedTodaysBookings(todaysBookings).map((b) => {
                const status = bookingStatusColor(b);
                const paid = paymentStatus?.online_payment_enabled ? paymentStatus.statuses[b.id] : undefined;
                return (
                  <Pressable key={b.id} onPress={() => openBooking(b)}>
                    <BlurView intensity={90} tint="dark" style={styles.apptCard}>
                      <CardOverlay />
                      <View style={styles.apptAvatar}>
                        <Text style={styles.apptAvatarText}>{initials(b.customer?.name ?? '?')}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.apptName} numberOfLines={1}>{b.customer?.name ?? 'Customer'}</Text>
                        <Text style={styles.apptMeta} numberOfLines={1}>
                          {timeLabel(b.starts_at)} · {b.service?.name ?? 'Service'}{b.staff?.name ? ` · ${b.staff.name}` : ''}
                        </Text>
                      </View>
                      {paid !== undefined && (
                        <View style={[styles.paidBadge, paid ? styles.paidBadgeYes : styles.paidBadgeNo]}>
                          <Text style={[styles.paidBadgeText, { color: paid ? '#4ADE80' : '#F09595' }]}>{paid ? 'Paid' : 'Unpaid'}</Text>
                        </View>
                      )}
                      <View style={[styles.statusBadge, { borderColor: status.color, backgroundColor: `${status.color}22` }]}>
                        <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </BlurView>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Recent Activity */}
          <RecentActivity bookings={todaysBookings} paymentStatus={paymentStatus} />
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
      <Text style={styles.snapshotValue}>{value}</Text>
      {trend != null && <Text style={[styles.snapshotTrend, { color: trend >= 0 ? '#4ADE80' : '#F09595' }]}>{trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%</Text>}
      <Text style={styles.snapshotLabel}>{label}</Text>
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
// schedule, no extra fetch) plus a real event feed reusing the same
// `notifications` rows the bell icon shows (new booking/cancellation/
// reschedule/checkout/no-show — Sprint 9 extended checkout + no-show to
// notify too, so this feed has full coverage, not just booking events).
function RecentActivity({ bookings, paymentStatus }: { bookings: OwnerBooking[]; paymentStatus: PaymentStatusResult | null }) {
  const [notifications, setNotifications] = useState<OwnerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listNotifications().then(r => {
      if (r.ok) setNotifications(r.data.data.slice(0, 6));
      setLoading(false);
    });
  }, []);

  const active = bookings.filter(b => b.status !== 'cancelled');
  const confirmedCount = active.filter(b => !['completed', 'no_show'].includes(b.status)).length;
  const walkInCount = active.filter(b => b.source === 'walk_in').length;
  const openCount = findEmptySpaces(active, dayScheduleFor(null, new Date()), 20).length;

  return (
    <View style={styles.activitySection}>
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.statsRow}>
        <StatChip label="Total Appts" value={String(active.length)} />
        <StatChip label="Confirmed" value={String(confirmedCount)} />
        <StatChip label="Open Slots" value={String(openCount)} />
        <StatChip label="Walk-Ins" value={String(walkInCount)} />
      </View>
      {loading ? (
        <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}><BreathingHeart size={22} color="#F4D77A" /></View>
      ) : notifications.length === 0 ? (
        <Text style={styles.activityEmpty}>No recent activity yet.</Text>
      ) : (
        <BlurView intensity={90} tint="dark" style={styles.activityCard}>
          <CardOverlay />
          {notifications.map((n, i) => {
            const paid = paymentStatus?.online_payment_enabled && n.type === 'payment' && n.booking_id
              ? paymentStatus.statuses[n.booking_id]
              : undefined;
            return (
              <View key={n.id} style={[styles.activityRow, i > 0 && styles.activityRowBorder]}>
                <View style={styles.activityDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>{n.title}</Text>
                  <Text style={styles.activityBody} numberOfLines={1}>{n.body}</Text>
                </View>
                {paid !== undefined && (
                  <View style={[styles.paidBadge, paid ? styles.paidBadgeYes : styles.paidBadgeNo]}>
                    <Text style={[styles.paidBadgeText, { color: paid ? '#4ADE80' : '#F09595' }]}>{paid ? 'Paid' : 'Unpaid'}</Text>
                  </View>
                )}
                <Text style={styles.activityTime}>{timeAgo(n.created_at)}</Text>
              </View>
            );
          })}
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

  healthCard: {
    padding: Spacing.md,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  healthLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.6)',
  },
  healthScore: { fontFamily: FontFamily.frauncesBold, fontSize: 36, marginTop: 2 },
  healthSub: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },
  healthReasons: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    padding: Spacing.sm,
    gap: 4,
    marginTop: -Spacing.xs,
  },
  healthReasonText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },

  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  snapshotCard: {
    width: '47%',
    padding: Spacing.md,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  snapshotValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: '#FFFFFF' },
  snapshotTrend: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs },
  snapshotLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

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
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
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
  statusBadge: {
    borderRadius: 12, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8,
  },
  statusBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: 10.5 },

  paidBadge: { borderRadius: 12, borderWidth: 1, paddingVertical: 4, paddingHorizontal: 8 },
  paidBadgeYes: { borderColor: '#4ADE80', backgroundColor: 'rgba(74,222,128,0.13)' },
  paidBadgeNo: { borderColor: '#F09595', backgroundColor: 'rgba(240,149,149,0.13)' },
  paidBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: 10.5 },

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
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  activityRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  activityDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F4D77A' },
  activityTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  activityBody: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  activityTime: { fontFamily: FontFamily.sora, fontSize: 10.5, color: 'rgba(255,255,255,0.4)' },
  activityEmpty: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingVertical: Spacing.md },
});
