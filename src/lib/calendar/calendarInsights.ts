import { OwnerBooking } from '@/lib/api/ownerBookings';
import { DaySchedule, gridBoundsMinutes, minutesSinceMidnight } from './timeGrid';

export interface EmptySpace {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

// Phase 0.3 Smart Empty Spaces — real gaps in today's schedule, computed
// from the bookings + business hours already loaded (no server round-trip).
export function findEmptySpaces(bookings: OwnerBooking[], schedule: DaySchedule, minGapMinutes = 20): EmptySpace[] {
  const { start, end } = gridBoundsMinutes(schedule);
  const active = bookings
    .filter(b => b.status !== 'cancelled')
    .map(b => ({ start: minutesSinceMidnight(b.starts_at), end: minutesSinceMidnight(b.ends_at) }))
    .sort((a, b) => a.start - b.start);

  const gaps: EmptySpace[] = [];
  let cursor = start;
  for (const b of active) {
    if (b.start > cursor + minGapMinutes) {
      gaps.push({ startMinutes: cursor, endMinutes: b.start, durationMinutes: b.start - cursor });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (end > cursor + minGapMinutes) {
    gaps.push({ startMinutes: cursor, endMinutes: end, durationMinutes: end - cursor });
  }
  return gaps;
}

export interface CalendarAlert {
  message: string;
  severity: 'info' | 'warning';
}

// Phase 0.3's background "AI layer" — rule-based checks over today's real
// data (gap too small/large, stylist idle, overtime coming). Same
// seed-not-fake doctrine as everywhere else.
export function computeCalendarAlerts(bookings: OwnerBooking[], schedule: DaySchedule): CalendarAlert[] {
  const alerts: CalendarAlert[] = [];
  const active = bookings.filter(b => b.status !== 'cancelled');
  const now = new Date();
  const nowMin = minutesSinceMidnight(now.toISOString());

  const lateCount = active.filter(b => {
    const startMin = minutesSinceMidnight(b.starts_at);
    return !b.checked_in_at && startMin < nowMin - 10 && startMin > nowMin - 120;
  }).length;
  if (lateCount > 0) alerts.push({ message: `${lateCount} customer${lateCount === 1 ? ' is' : 's are'} running late and haven't checked in.`, severity: 'warning' });

  const { end } = gridBoundsMinutes(schedule);
  const lastEnd = active.reduce((max, b) => Math.max(max, minutesSinceMidnight(b.ends_at)), 0);
  if (lastEnd > end) alerts.push({ message: `Today runs ${lastEnd - end} min past closing — overtime likely.`, severity: 'warning' });

  const gaps = findEmptySpaces(active, schedule, 45);
  const bigGap = gaps.find(g => g.durationMinutes >= 60);
  if (bigGap) alerts.push({ message: `A ${Math.round(bigGap.durationMinutes / 60)}-hour opening today — worth a fill-it push.`, severity: 'info' });

  return alerts;
}
