import { useState } from 'react';
import { Stack } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { getOwnerReport, OwnerReport, ReportRange } from '@/lib/api/ownerReports';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { formatCentsUSDWhole } from '@/lib/i18n/format';

function money(cents: number) { return formatCentsUSDWhole(cents); }

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
// Moved out of the owner tab bar into More on 2026-08-17 to free up the
// tab slot SANAA now occupies (SANAA-P0/P1-SPEC §4.1) -- same screen,
// reached one tap further in, native Stack header like other More entries
// (owner-settings/business.tsx etc.) instead of the tab-bar OwnerScreenHeader.
export default function OwnerReportsScreen() {
  const { t } = useTranslation(['owner']);
  const HEADER_OPTIONS = {
    headerStyle: { backgroundColor: '#0B0712' },
    headerTintColor: '#F4D77A',
    headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
    title: t('owner:reportsScreen.headerTitle'),
    headerBackTitle: t('owner:reportsScreen.headerBackTitle'),
  };
  const RANGES: { key: ReportRange; label: string }[] = [
    { key: 'today', label: t('owner:reportsScreen.rangeToday') },
    { key: 'week', label: t('owner:reportsScreen.rangeWeek') },
    { key: 'month', label: t('owner:reportsScreen.rangeMonth') },
  ];
  const [range, setRange] = useState<ReportRange>('week');
  // Perf pass — cached per range under React Query so flipping between
  // Today/Week/Month and back (and revisiting this screen at all -- it's
  // pushed onto the stack, fully unmounts on every visit) reads whatever
  // was already fetched instantly instead of blanking to a spinner and
  // re-fetching every time.
  const reportQuery = useQuery({
    queryKey: ['owner-report', range],
    queryFn: async () => {
      const result = await getOwnerReport(range);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
  const report = reportQuery.data ?? null;
  const loading = reportQuery.isLoading;
  const error = reportQuery.isError ? (reportQuery.error instanceof Error ? reportQuery.error.message : t('owner:reportsScreen.unableToLoad')) : null;

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={HEADER_OPTIONS} />

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
        <ErrorState message={error} onRetry={() => reportQuery.refetch()} />
      ) : !report ? null : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.snapshotGrid}>
            <SnapshotCard label={t('owner:reportsScreen.revenue')} value={money(report.revenue_cents)} />
            <SnapshotCard label={t('owner:reportsScreen.appointments')} value={String(report.appointments)} />
            <SnapshotCard label={t('owner:reportsScreen.clients')} value={String(report.clients)} />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('owner:reportsScreen.topServices')}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              {report.top_services.length === 0 ? (
                <Text style={styles.emptyRowText}>{t('owner:reportsScreen.noCompletedAppointments')}</Text>
              ) : (
                report.top_services.map((s, i) => (
                  <View key={s.name} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowMeta}>{t('owner:reportsScreen.appointmentCount', { count: s.count })}</Text>
                    </View>
                    <Text style={styles.rowValue}>{money(s.revenue_cents)}</Text>
                  </View>
                ))
              )}
            </BlurView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('owner:reportsScreen.byStaff')}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              {report.by_staff.length === 0 ? (
                <Text style={styles.emptyRowText}>{t('owner:reportsScreen.noCompletedAppointments')}</Text>
              ) : (
                report.by_staff.map((s, i) => (
                  <View key={s.name} style={[styles.row, i > 0 && styles.rowBorder]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowMeta}>{t('owner:reportsScreen.appointmentCount', { count: s.count })}</Text>
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
  rangeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.md },
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
