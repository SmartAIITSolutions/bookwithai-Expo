import { OwnerBooking } from '@/lib/api/ownerBookings';
import { DaySchedule, gridBoundsMinutes, minutesSinceMidnight, zonedMinutesSinceMidnight } from './timeGrid';

export interface EmptySpace {
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
}

// Phase 0.3 Smart Empty Spaces — real gaps in today's schedule, computed
// from the bookings + business hours already loaded (no server round-trip).
// `timeZone` is optional and additive (Calendar 2.0 Part 1) -- when passed,
// gap boundaries are computed in the salon's own zone instead of the
// device's; omitted, this behaves exactly as it always has for the callers
// that haven't been moved onto salon-timezone math yet (Dashboard/Month/
// 3-Day/Week), so their existing behavior is untouched.
export function findEmptySpaces(bookings: OwnerBooking[], schedule: DaySchedule, minGapMinutes = 20, timeZone?: string): EmptySpace[] {
  const { start, end } = gridBoundsMinutes(schedule);
  const toMinutes = (iso: string) => timeZone ? zonedMinutesSinceMidnight(iso, timeZone) : minutesSinceMidnight(iso);
  const active = bookings
    .filter(b => b.status !== 'cancelled')
    .map(b => ({ start: toMinutes(b.starts_at), end: toMinutes(b.ends_at) }))
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
