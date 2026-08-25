import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { DayKpis } from '@/lib/calendar/dayKpis';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

function formatMoney(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

function UtilizationRing({ percent }: { percent: number }) {
  const size = 22, stroke = 3, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const filled = c * Math.min(1, Math.max(0, percent / 100));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={P.border} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2} cy={size / 2} r={r} stroke={P.secondaryPurple} strokeWidth={stroke} fill="none"
        strokeDasharray={`${filled} ${c}`} strokeLinecap="round"
        rotation={-90} origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

function KpiCard({ value, label, icon }: { value: string; label: string; icon: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <Text style={styles.value} numberOfLines={1}>{value}</Text>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
      </View>
      {icon}
    </View>
  );
}

// Calendar 2.0 Day View — Part 5. Every value is real, computed by
// computeDayKpis() from bookings + business hours already loaded for this
// screen; nothing here is a placeholder outside the sample fixture.
export function DayKpiStrip({ kpis }: { kpis: DayKpis }) {
  return (
    <View style={styles.row}>
      <KpiCard
        value={String(kpis.appointments)} label="Appointments"
        icon={<Ionicons name="calendar" size={18} color={P.secondaryPurple} />}
      />
      <KpiCard
        value={formatMoney(kpis.bookedCents)} label="Booked"
        icon={<View style={[styles.dollarCircle]}><Text style={styles.dollarText}>$</Text></View>}
      />
      <KpiCard
        value={String(kpis.openGaps)} label="Open Gaps"
        icon={<Ionicons name="sparkles" size={17} color={P.accentGold} />}
      />
      <KpiCard
        value={`${kpis.utilizationPercent}%`} label="Utilization"
        icon={<UtilizationRing percent={kpis.utilizationPercent} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  card: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: P.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: P.border,
    paddingHorizontal: 10, paddingVertical: 10, minWidth: 0,
  },
  value: { fontSize: 17, fontWeight: '800', color: P.textPrimary },
  label: { fontSize: 10, color: P.textSecondary, marginTop: 1 },
  dollarCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: P.accentGold,
    alignItems: 'center', justifyContent: 'center',
  },
  dollarText: { fontSize: 11, fontWeight: '800', color: P.accentGold },
});
