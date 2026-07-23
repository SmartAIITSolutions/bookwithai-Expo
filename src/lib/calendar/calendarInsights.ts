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
