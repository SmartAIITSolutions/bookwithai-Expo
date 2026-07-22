import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor } from '@/lib/calendar/bookingStatus';
import { findEmptySpaces } from '@/lib/calendar/calendarInsights';
import { DaySchedule } from '@/lib/calendar/timeGrid';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import { Spacing, BorderRadius } from '@/constants/Spacing';

interface AgendaViewProps {
  bookings: OwnerBooking[];
  schedule: DaySchedule | null;
  onOpen: (b: OwnerBooking) => void;
  onFillSlot: () => void;
}

type AgendaRow =
  | { kind: 'booking'; minutes: number; booking: OwnerBooking }
  | { kind: 'open'; minutes: number; durationMinutes: number };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// One of Phase 0.3's six calendar modes — a time-sorted list, now
// interleaved with real "Open Slot" placeholders computed from the day's
// actual gaps (not just booked appointments), matching the design spec.
export function AgendaView({ bookings, schedule, onOpen, onFillSlot }: AgendaViewProps) {
  const active = bookings.filter(b => b.status !== 'cancelled');
  const gaps = schedule ? findEmptySpaces(active, schedule, 30) : [];

  const rows: AgendaRow[] = [
    ...active.map(b => ({ kind: 'booking' as const, minutes: new Date(b.starts_at).getHours() * 60 + new Date(b.starts_at).getMinutes(), booking: b })),
    ...gaps.map(g => ({ kind: 'open' as const, minutes: g.startMinutes, durationMinutes: g.durationMinutes })),
  ].sort((a, b) => a.minutes - b.minutes);

  function formatMinutes(mins: number) {
    const h24 = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.list}>
      {rows.length === 0 && <Text style={styles.emptyHint}>Nothing on the books for this day.</Text>}
      {rows.map((row, i) => {
        if (row.kind === 'open') {
          return (
            <Pressable key={`open-${i}`} style={styles.openRow} onPress={onFillSlot}>
              <Text style={styles.time}>{formatMinutes(row.minutes)}</Text>
              <View style={styles.openIcon}>
                <Ionicons name="add" size={16} color={P.accentGold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.openLabel}>Open Slot</Text>
                <Text style={styles.openHint}>Tap to fill</Text>
              </View>
            </Pressable>
          );
        }
        const b = row.booking;
        const { color, label } = bookingStatusColor(b);
        const name = b.customer?.name ?? 'Customer';
        return (
          <Pressable key={b.id} style={styles.row} onPress={() => onOpen(b)}>
            <Text style={styles.time}>{formatMinutes(row.minutes)}</Text>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(name)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.customer} numberOfLines={1}>{name}</Text>
              <Text style={styles.meta} numberOfLines={1}>{b.service?.name ?? 'Service'}{b.staff?.name ? ` · ${b.staff.name}` : ''}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: color + '26', borderColor: color }]}>
              <Text style={[styles.badgeText, { color }]}>{label}</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: P.textDisabled, textAlign: 'center', marginTop: Spacing['2xl'] },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: P.card,
    borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: P.border, padding: Spacing.md,
  },
  openRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(255,200,87,0.06)',
    borderRadius: BorderRadius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.accentGold,
    padding: Spacing.md,
  },
  time: { fontSize: 12.5, color: P.textSecondary, fontWeight: '700', width: 68 },
  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: P.elevatedSurface,
    borderWidth: 1, borderColor: P.border, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 12.5, fontWeight: '700', color: P.secondaryPurple },
  openIcon: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: P.accentGold,
  },
  customer: { fontSize: 15, fontWeight: '700', color: P.textPrimary },
  meta: { fontSize: 12.5, color: P.textSecondary, marginTop: 2 },
  openLabel: { fontSize: 14, fontWeight: '700', color: P.accentGold },
  openHint: { fontSize: 12, color: P.textDisabled, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
});
