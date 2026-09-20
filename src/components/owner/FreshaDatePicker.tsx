import { useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { formatMonthYear } from '@/lib/i18n/format';

// Fresha-parity date picker — replaces the old single-month prev/next
// CalendarDatePicker for the Calendar screen's own top date control. Fresha's
// own picker (confirmed live on a real Fresha Business account) is not a
// paginated one-month-at-a-time grid: it's a vertically scrollable list of
// several months at once, Monday-first weekday header, plus a row of
// "In 1/2/3/4 weeks" quick-jump chips above it. This is a from-scratch
// component rather than an extension of CalendarDatePicker because the
// interaction model (scroll through months vs. page through them) is
// genuinely different, not just a style change.

const MONTHS_AHEAD = 13; // current month + a year forward, generous scroll room
const CELL_SIZE = 40;

// Monday-first weekday index (0=Mon..6=Sun) -- Fresha's own header reads
// "Mon Tue Wed Thu Fri Sat Sun", not the Sunday-first convention the rest of
// this app's DAY_KEYS/date.getDay() use elsewhere (that convention is left
// untouched everywhere else; this picker's grid layout is the one place
// that needs to visually match Fresha's own Monday-first ordering).
function mondayFirstIndex(jsGetDay: number): number {
  return (jsGetDay + 6) % 7;
}

interface Props {
  visible: boolean;
  selectedDate: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
}

function MonthGrid({ year, month, selectedDate, onSelect }: {
  year: number; month: number; selectedDate: Date; onSelect: (d: Date) => void;
}) {
  const { t } = useTranslation(['calendar']);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayMon = mondayFirstIndex(new Date(year, month, 1).getDay());
  const cells: (number | null)[] = [
    ...Array(firstDayMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const dayHeaderKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

  return (
    <View style={styles.monthBlock}>
      <Text style={styles.monthLabel}>{formatMonthYear(year, month)}</Text>
      <View style={styles.dayLabelsRow}>
        {dayHeaderKeys.map(k => (
          <Text key={k} style={styles.dayLabel}>{t(`calendar:datePicker.weekday.${k}` as never)}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.gridRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={styles.cell} />;
            const cellDate = new Date(year, month, day);
            const isSelected =
              selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day;
            const isToday =
              today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
            return (
              <Pressable
                key={di}
                style={[styles.cell, isToday && !isSelected && styles.cellTodayRing, isSelected && styles.cellSelected]}
                onPress={() => onSelect(cellDate)}
              >
                <Text style={[styles.cellText, isSelected && styles.cellTextSelected, isToday && !isSelected && styles.cellTextToday]}>
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

export function FreshaDatePicker({ visible, selectedDate, onSelect, onClose }: Props) {
  const { t } = useTranslation(['calendar']);
  const scrollRef = useRef<ScrollView>(null);

  const months = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return Array.from({ length: MONTHS_AHEAD }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  function jumpWeeks(weeks: number) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + weeks * 7);
    onSelect(d);
    onClose();
  }

  function handlePick(d: Date) {
    onSelect(d);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.closeRow}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={P.textPrimary} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
          {[1, 2, 3, 4].map(w => (
            <Pressable key={w} style={styles.chip} onPress={() => jumpWeeks(w)}>
              <Text style={styles.chipText}>{t('calendar:datePicker.inWeeks', { count: w })}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.monthsContent}>
          {months.map(m => (
            <MonthGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month} selectedDate={selectedDate} onSelect={handlePick} />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, top: 60,
    backgroundColor: P.background, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
  },
  closeRow: { alignItems: 'flex-end', paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  chipScroll: { flexGrow: 0, marginBottom: Spacing.md },
  chipRow: { flexDirection: 'row', gap: Spacing.xs, paddingHorizontal: Spacing.lg },
  chip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: P.border, backgroundColor: P.card,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: P.textPrimary },
  monthsContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  monthBlock: { marginBottom: Spacing.lg },
  monthLabel: { fontSize: 18, fontWeight: '700', color: P.textPrimary, marginBottom: Spacing.sm },
  dayLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  dayLabel: { fontSize: 11, fontWeight: '600', color: P.textSecondary, width: CELL_SIZE, textAlign: 'center' },
  gridRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  // Calendar parity pass (audit §02) — Fresha draws an outlined ring around
  // "today" distinct from the selected day's filled purple circle; BWA
  // previously only bolded/colored the number.
  cellTodayRing: { borderWidth: 1.5, borderColor: P.accentGold },
  cellSelected: { backgroundColor: P.primaryPurple },
  cellText: { fontSize: 15, color: P.textPrimary },
  cellTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  cellTextToday: { color: P.accentGold, fontWeight: '700' },
});
