import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { AIInsightSlot } from '@/components/owner/AIInsightSlot';
import { AppointmentSheet } from '@/components/owner/AppointmentSheet';
import { getDashboard, DashboardData } from '@/lib/api/ownerDashboard';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

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

// Phase 0.2 Dashboard — "answer 'Am I okay today?' in under 5 seconds."
export default function OwnerDashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [todaysBookings, setTodaysBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<OwnerBooking | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const dayIndex = now.getDate() % THOUGHTS.length;

  const load = useCallback(async () => {
    const [dash, bookings] = await Promise.all([getDashboard(), listBookingsForDate(todayKey)]);
    if (dash.ok) setData(dash.data);
    if (bookings.ok) setTodaysBookings(bookings.data.data);
    setLoading(false);
  }, [todayKey]);

  useEffect(() => { load(); }, [load]);

  const nextAppointment = data?.next_appointment_id
    ? todaysBookings.find(b => b.id === data.next_appointment_id) ?? null
    : null;

  function openBooking(b: OwnerBooking) {
    setSelectedBooking(b);
    sheetRef.current?.present();
  }

  const healthColor = !data ? Colors.textSecondary
    : data.health.score >= 80 ? Colors.success
    : data.health.score >= 50 ? Colors.warning
    : Colors.error;

  return (
    <View style={styles.container}>
      <OwnerScreenHeader title="Dashboard" onNotificationsPress={() => router.push('/owner-notifications' as never)} />
      {loading || !data ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Greeting */}
          <View>
            <Text style={styles.greeting}>{greetingWord(now.getHours())} 👋</Text>
            <Text style={styles.date}>{now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
            <Text style={styles.thought}>{THOUGHTS[dayIndex]}</Text>
          </View>

          {/* Business Health Score */}
          <TouchableOpacity style={styles.healthCard} onPress={() => setHealthExpanded(v => !v)}>
            <Text style={styles.healthLabel}>Business Health</Text>
            <Text style={[styles.healthScore, { color: healthColor }]}>{data.health.score}</Text>
            <Text style={styles.healthSub}>{data.health.label}</Text>
          </TouchableOpacity>
          {healthExpanded && (
            <View style={styles.healthReasons}>
              {data.health.reasons.map((r, i) => <Text key={i} style={styles.healthReasonText}>• {r}</Text>)}
            </View>
          )}

          {/* AI Insights */}
          {data.insights.map((ins, i) => <AIInsightSlot key={i} message={ins} />)}

          {/* Today's Snapshot */}
          <View style={styles.snapshotGrid}>
            <SnapshotCard label="Revenue" value={money(data.snapshot.revenue_cents)} trend={data.snapshot.revenue_trend_pct} />
            <SnapshotCard label="Appointments" value={String(data.snapshot.appointments)} />
            <SnapshotCard label="Clients" value={String(data.snapshot.clients)} />
            <SnapshotCard label="Occupancy" value={`${data.snapshot.occupancy_pct}%`} />
          </View>

          {/* Next Appointment */}
          {nextAppointment && (
            <TouchableOpacity style={styles.nextCard} onPress={() => openBooking(nextAppointment)}>
              <Text style={styles.nextTime}>
                {new Date(nextAppointment.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </Text>
              <Text style={styles.nextCustomer}>{nextAppointment.customer?.name ?? 'Customer'}</Text>
              <Text style={styles.nextMeta}>
                {nextAppointment.service?.name ?? 'Service'}{nextAppointment.staff?.name ? ` · ${nextAppointment.staff.name}` : ''}
              </Text>
              <Text style={styles.nextOpen}>OPEN →</Text>
            </TouchableOpacity>
          )}

          {/* Today's Timeline */}
          {todaysBookings.length > 0 && (
            <View style={styles.timelineStrip}>
              {todaysBookings.filter(b => b.status !== 'cancelled').slice(0, 8).map(b => (
                <View key={b.id} style={styles.timelineDotWrap}>
                  <Text style={styles.timelineHour}>
                    {new Date(b.starts_at).toLocaleTimeString('en-US', { hour: 'numeric' })}
                  </Text>
                  <View style={styles.timelineDot} />
                </View>
              ))}
            </View>
          )}

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <QuickActionButton label="+ Appointment" onPress={() => router.push('/(owner)/calendar' as never)} />
            <QuickActionButton label="+ Customer" onPress={() => router.push('/(owner)/customers' as never)} />
            <QuickActionButton label="Checkout" onPress={() => router.push('/(owner)/calendar' as never)} />
            <QuickActionButton label="Calendar" onPress={() => router.push('/(owner)/calendar' as never)} />
          </View>
        </ScrollView>
      )}
      <AppointmentSheet ref={sheetRef} booking={selectedBooking} onChanged={() => { sheetRef.current?.dismiss(); load(); }} />
    </View>
  );
}

function SnapshotCard({ label, value, trend }: { label: string; value: string; trend?: number | null }) {
  return (
    <View style={styles.snapshotCard}>
      <Text style={styles.snapshotValue}>{value}</Text>
      {trend != null && <Text style={[styles.snapshotTrend, { color: trend >= 0 ? Colors.success : Colors.error }]}>{trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%</Text>}
      <Text style={styles.snapshotLabel}>{label}</Text>
    </View>
  );
}

function QuickActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing['2xl'] },
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  date: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  thought: { fontSize: 13, color: Colors.textSecondary, fontStyle: 'italic', marginTop: 6 },
  healthCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  healthLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', color: Colors.textSecondary },
  healthScore: { fontSize: 36, fontWeight: '800', marginTop: 2 },
  healthSub: { fontSize: 13, color: Colors.textSecondary },
  healthReasons: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, padding: Spacing.sm, gap: 4, marginTop: -Spacing.xs },
  healthReasonText: { fontSize: 13, color: Colors.textSecondary },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  snapshotCard: { width: '47%', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  snapshotValue: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  snapshotTrend: { fontSize: 12, fontWeight: '700' },
  snapshotLabel: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  nextCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  nextTime: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  nextCustomer: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },
  nextMeta: { fontSize: 13.5, color: Colors.textSecondary, marginTop: 2 },
  nextOpen: { fontSize: 13, color: Colors.primary, fontWeight: '700', marginTop: Spacing.xs },
  timelineStrip: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  timelineDotWrap: { alignItems: 'center', gap: 4 },
  timelineHour: { fontSize: 10.5, color: Colors.textSecondary },
  timelineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.primary },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  quickActionButton: { flexGrow: 1, backgroundColor: Colors.buttonPrimaryBg, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', minWidth: '47%', ...Shadows.button },
  quickActionText: { color: Colors.buttonPrimaryText, fontSize: 14, fontWeight: '700' },
});
