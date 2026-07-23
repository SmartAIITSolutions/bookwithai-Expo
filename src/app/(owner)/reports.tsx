import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { getOwnerReport, OwnerReport, ReportRange } from '@/lib/api/ownerReports';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const RANGES: { key: ReportRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

function money(cents: number) { return `$${(cents / 100).toFixed(0)}`; }

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// v1 real-data Reports -- revenue, appointments, and staff/service
// breakdowns computed from completed bookings already in the database.
// Deliberately simple (three ranges, no charts, no export yet) rather than
// shipping the tab as a permanent placeholder.
export default function OwnerReportsScreen() {
  const [range, setRange] = useState<ReportRange>('week');
  const [report, setReport] = useState<OwnerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getOwnerReport(range)
      .then(result => {
        if (result.ok) setReport(result.data);
        else setError(result.error);
      })
      // getOwnerReport's underlying fetch() rejects (not just resolves
      // ok:false) on a real network failure -- without this, that leaves
      // `loading` stuck true forever with no error shown, which is exactly
      // what looked like a permanent spinner that "doesn't do anything".
      .catch(() => setError('Unable to load reports. Please check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <OwnerScreenHeader title="Reports" onNotificationsPress={() => router.push('/owner-notifications' as never)} />

      <View style={styles.rangeRow}>
        {RANGES.map(r => (
          <Pressable
            key={r.key}
            style={[styles.rangeChip, range === r.key && styles.rangeChipActive]}
            onPress={() => setRange(r.key)}
          >
            <Text style={[styles.rangeChipText, range === r.key && styles.rangeChipTextActive]}>{r.label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !report ? null : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.snapshotGrid}>
            <SnapshotCard label="Revenue" value={money(report.revenue_cents)} />
            <SnapshotCard label="Appointments" value={String(report.appointments)} />
            <SnapshotCard label="Clients" value={String(report.clients)} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Services</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              {report.top_services.length === 0 ? (
                <Text style={styles.emptyRowText}>No completed appointments in this range yet.</Text>
              ) : (
                report.top_services.map((s, i) => (
                  <View key={s.name} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowMeta}>{s.count} appointment{s.count === 1 ? '' : 's'}</Text>
                    </View>
                    <Text style={styles.rowValue}>{money(s.revenue_cents)}</Text>
                  </View>
                ))
              )}
            </BlurView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>By Staff</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              {report.by_staff.length === 0 ? (
                <Text style={styles.emptyRowText}>No completed appointments in this range yet.</Text>
              ) : (
                report.by_staff.map((s, i) => (
                  <View key={s.name} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowMeta}>{s.count} appointment{s.count === 1 ? '' : 's'}</Text>
                    </View>
                    <Text style={styles.rowValue}>{money(s.revenue_cents)}</Text>
                  </View>
                ))
              )}
            </BlurView>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function SnapshotCard({ label, value }: { label: string; value: string }) {
  return (
    <BlurView intensity={90} tint="dark" style={styles.snapshotCard}>
      <CardOverlay />
      <Text style={styles.snapshotValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.snapshotLabel} numberOfLines={1}>{label}</Text>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rangeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  rangeChip: {
    paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
  },
  rangeChipActive: { backgroundColor: 'rgba(212,175,55,0.9)', borderColor: '#F4D77A' },
  rangeChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)' },
  rangeChipTextActive: { color: '#09000F' },
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 110 },
  snapshotGrid: { flexDirection: 'row', gap: Spacing.xs },
  snapshotCard: {
    flex: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, alignItems: 'center',
    borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  snapshotValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF', textAlign: 'center' },
  snapshotLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', marginTop: 2, textAlign: 'center' },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: Spacing.md, gap: Spacing.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  rowTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  rowMeta: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  rowValue: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.base, color: '#F4D77A' },
  emptyRowText: {
    fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)',
    padding: Spacing.md, textAlign: 'center',
  },
});
