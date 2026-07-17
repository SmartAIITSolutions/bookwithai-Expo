import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getMonthSummary } from '@/lib/api/ownerCalendarSummary';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';

interface MonthViewProps {
  month: Date; // any date within the target month
  onSelectDate: (d: Date) => void;
}

// One of Phase 0.3's six calendar modes — "for planning only, never the
// default, never used for daily operations." Tapping a day jumps to Day view.
export function MonthView({ month, onSelectDate }: MonthViewProps) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    getMonthSummary(monthKey).then(r => { if (r.ok) setCounts(r.data.counts); });
  }, [monthKey]);

  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const todayKey = new Date().toISOString().slice(0, 10);

  const cells: (Date | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.weekdayRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <Text key={i} style={styles.weekdayLabel}>{d}</Text>)}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const key = d.toISOString().slice(0, 10);
          const count = counts[key] ?? 0;
          const isToday = key === todayKey;
          return (
            <TouchableOpacity key={i} style={styles.cell} onPress={() => onSelectDate(d)}>
              <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{d.getDate()}</Text>
              {count > 0 && <Text style={styles.countDot}>{count}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  weekdayRow: { flexDirection: 'row' },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dayNumber: { fontSize: 13, color: Colors.textPrimary },
  dayNumberToday: { color: Colors.primary, fontWeight: '800' },
  countDot: {
    fontSize: 10, color: Colors.textOnPrimary, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full, paddingHorizontal: 5, marginTop: 2, overflow: 'hidden',
  },
});
