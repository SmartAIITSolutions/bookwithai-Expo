import { useState } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
// Every 30 minutes, 7am-9pm -- covers normal salon hours without an
// unbounded scroll; matches the granularity slots are already offered in
// elsewhere in this app (WalkInSheet, booking widget).
const TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const totalMin = 7 * 60 + i * 30;
  return { hour: Math.floor(totalMin / 60), minute: totalMin % 60 };
});

function fmtTime(hour: number, minute: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

interface RebookDateTimeModalProps {
  visible: boolean;
  initialDate: Date;
  onCancel: () => void;
  onConfirm: (date: Date) => void;
}

// Month-grid date picker + time-slot picker, reusing the same grid layout
// MonthView.tsx already uses for the Calendar screen -- no date/time
// picker library exists anywhere in this app, so this stays consistent
// with the rest of the codebase rather than introducing one.
export function RebookDateTimeModal({ visible, initialDate, onCancel, onConfirm }: RebookDateTimeModalProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(initialDate.getDate());
  const [selectedYear, setSelectedYear] = useState(initialDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(initialDate.getMonth());
  const [selectedHour, setSelectedHour] = useState(initialDate.getHours());
  const [selectedMinute, setSelectedMinute] = useState(initialDate.getMinutes() >= 30 ? 30 : 0);

  const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  function shiftMonth(delta: number) {
    setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function pickDay(day: number) {
    setSelectedDay(day);
    setSelectedYear(viewMonth.getFullYear());
    setSelectedMonth(viewMonth.getMonth());
  }

  function handleConfirm() {
    const result = new Date(selectedYear, selectedMonth, selectedDay, selectedHour, selectedMinute);
    onConfirm(result);
  }

  const isSelectedMonth = viewMonth.getFullYear() === selectedYear && viewMonth.getMonth() === selectedMonth;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <Text style={styles.title}>Pick a date & time</Text>

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color="#F4D77A" />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
              <Ionicons name="chevron-forward" size={18} color="#F4D77A" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map(d => <Text key={d} style={styles.weekdayLabel}>{d}</Text>)}
          </View>
          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={styles.cell} />;
              const isSelected = isSelectedMonth && day === selectedDay;
              return (
                <Pressable key={i} style={styles.cell} onPress={() => pickDay(day)}>
                  <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                    <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{day}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>Time</Text>
          <ScrollView style={styles.timeScroll} contentContainerStyle={styles.timeGrid}>
            {TIME_SLOTS.map(({ hour, minute }) => {
              const active = hour === selectedHour && minute === selectedMinute;
              return (
                <TouchableOpacity
                  key={`${hour}:${minute}`}
                  style={[styles.timeChip, active && styles.timeChipActive]}
                  onPress={() => { setSelectedHour(hour); setSelectedMinute(minute); }}
                >
                  <Text style={[styles.timeChipText, active && styles.timeChipTextActive]}>{fmtTime(hour, minute)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm}><Text style={styles.confirmText}>Confirm</Text></TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)' },
  card: {
    width: '100%', maxWidth: 380, maxHeight: '85%', borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: '#0B0712',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF', marginBottom: 4 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.sm },
  monthLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  weekdayRow: { flexDirection: 'row', marginTop: Spacing.xs },
  weekdayLabel: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: FontFamily.soraSemiBold, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: '#F4D77A' },
  dayNumber: { fontFamily: FontFamily.sora, fontSize: 13, color: '#FFFFFF' },
  dayNumberSelected: { color: '#09000F', fontFamily: FontFamily.soraSemiBold },
  sectionLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.6, color: '#F4D77A', marginTop: Spacing.xs,
  },
  timeScroll: { maxHeight: 140 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 4 },
  timeChip: {
    paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  timeChipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  timeChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12, color: '#FFFFFF' },
  timeChipTextActive: { color: '#09000F' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', paddingVertical: 8 },
  confirmText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A', paddingVertical: 8 },
});
