import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const CELL_SIZE = 34;

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDateStr(s: string): { year: number; month: number; day: number } | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

interface Props {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (dateStr: string) => void;
  minDate?: string; // 'YYYY-MM-DD' — dates before this are disabled
}

// Inline month-grid calendar picker — pure JS, no native date-picker module,
// so it doesn't require a native rebuild. Reuses the explicit-weekly-rows
// layout (not flexWrap) so columns always line up with the weekday header,
// same fix applied to the customer booking calendar.
export function CalendarDatePicker({ value, onChange, minDate }: Props) {
  const selected = parseDateStr(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = minDate ? parseDateStr(minDate) : null;
  const minDateObj = min ? new Date(min.year, min.month, min.day) : null;

  const [viewYear, setViewYear] = useState(selected?.year ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.getMonth());

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={18} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
        <Pressable onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.dayLabelsRow}>
        {DAYS.map((d) => <Text key={d} style={styles.dayLabel}>{d}</Text>)}
      </View>

      {weeks.map((week, weekIdx) => (
        <View key={weekIdx} style={styles.gridRow}>
          {week.map((day, idx) => {
            if (!day) return <View key={idx} style={styles.cell} />;
            const cellDate = new Date(viewYear, viewMonth, day);
            const isDisabled = !!minDateObj && cellDate < minDateObj;
            const isSelected =
              selected?.day === day && selected?.month === viewMonth && selected?.year === viewYear;
            const isToday =
              day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

            return (
              <Pressable
                key={idx}
                style={[
                  styles.cell,
                  isSelected && styles.cellSelected,
                  isToday && !isSelected && styles.cellToday,
                  isDisabled && styles.cellDisabled,
                ]}
                disabled={isDisabled}
                onPress={() => onChange(toDateStr(viewYear, viewMonth, day))}
              >
                <Text style={[
                  styles.cellText,
                  isSelected && styles.cellTextSelected,
                  isDisabled && styles.cellTextDisabled,
                ]}>
                  {day}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  dayLabelsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, width: CELL_SIZE, textAlign: 'center' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-around' },
  cell: {
    width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  cellSelected: { backgroundColor: Colors.primary },
  cellToday: { borderWidth: 1.5, borderColor: Colors.primary },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: 13, color: Colors.textPrimary },
  cellTextSelected: { color: Colors.textOnPrimary, fontWeight: '700' },
  cellTextDisabled: { color: Colors.textDisabled },
});
