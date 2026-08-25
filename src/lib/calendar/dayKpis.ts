import { OwnerBooking } from '@/lib/api/ownerBookings';
import { DaySchedule, gridBoundsMinutes, zonedMinutesSinceMidnight } from './timeGrid';
import { findEmptySpaces } from './calendarInsights';

export interface DayKpis {
  appointments: number;
  bookedCents: number;
  openGaps: number;
  utilizationPercent: number;
}

// Calendar 2.0 Day View KPI strip — Part 5. Every number here is a real,
// currently-computable value from data the Day screen already loads
// (bookings for the day + the salon's business-hours schedule); nothing is
// hardcoded outside the sample/demo fixture.
//
// Definitions (exact, per spec):
// - appointments: non-cancelled, non-time_block bookings in the displayed
//   day (a block isn't a client appointment).
// - bookedCents: sum of price_cents across every non-cancelled booking
//   (time_block rows are always price_cents=0, so including them is a
//   no-op -- not excluded separately to keep the rule to the one stated
//   exclusion, "do not include cancelled bookings").
// - openGaps: real gaps from findEmptySpaces() (the same function Day/3-Day/
//   Week already use), >=30min, the same threshold already used elsewhere
//   in this codebase (TimelineCalendar/MultiDayView both filter on this).
// - utilizationPercent: bookedMinutes / availableMinutes, where
//   availableMinutes = the schedule's own business-hours span MINUS any
//   time_block minutes inside it (blocked time reduces bookable capacity,
//   per the spec's own recommendation -- it is not "productive
//   utilization," but it isn't available capacity either). bookedMinutes
//   only counts non-cancelled, non-time_block bookings, each clipped to the
//   business-hours window so an appointment that starts before opening or
//   ends after closing doesn't inflate utilization past what was actually
//   available. Closed days (schedule.open === false) always report 0%,
//   never NaN or a fabricated number.
//
// Staff-filter scope: when a specific staff member is selected, the
// numerator (appointments/bookedCents/bookedMinutes/openGaps) is computed
// only from that staff's own bookings. The denominator (availableMinutes)
// still uses the salon's whole business-hours span, not that staff's own
// working hours -- per-staff availability (staff.availability) exists on
// the schema but is not yet wired into any Calendar view (confirmed during
// investigation), so using it here would silently imply a precision this
// first pass doesn't actually have. Documented, not fabricated.
export function computeDayKpis(bookings: OwnerBooking[], schedule: DaySchedule, timeZone: string): DayKpis {
  const real = bookings.filter(b => b.status !== 'cancelled' && b.source !== 'time_block');
  const blocks = bookings.filter(b => b.status !== 'cancelled' && b.source === 'time_block');

  const appointments = real.length;
  const bookedCents = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (b.price_cents ?? 0), 0);

  const gaps = schedule.open === false
    ? []
    : findEmptySpaces(bookings, schedule, 30, timeZone);
  const openGaps = gaps.filter(g => g.durationMinutes >= 30).length;

  if (schedule.open === false) {
    return { appointments, bookedCents, openGaps: 0, utilizationPercent: 0 };
  }

  const { start: boundStart, end: boundEnd } = gridBoundsMinutes(schedule);
  // Utilization is scoped to the salon's stated open hours, not the wider
  // 30-min-padded grid-render bounds (gridBoundsMinutes pads for display
  // legibility, not for what actually counts as "available").
  const openStart = schedule.start * 60;
  const openEnd = schedule.end * 60;
  const clip = (mins: number) => Math.min(openEnd, Math.max(openStart, mins));

  const minutesOf = (b: OwnerBooking) => {
    const start = clip(zonedMinutesSinceMidnight(b.starts_at, timeZone));
    const end = clip(zonedMinutesSinceMidnight(b.ends_at, timeZone));
    return Math.max(0, end - start);
  };

  const bookedMinutes = real.reduce((sum, b) => sum + minutesOf(b), 0);
  const blockedMinutes = blocks.reduce((sum, b) => sum + minutesOf(b), 0);
  const availableMinutes = Math.max(0, (openEnd - openStart) - blockedMinutes);

  const utilizationPercent = availableMinutes > 0
    ? Math.round(Math.min(100, (bookedMinutes / availableMinutes) * 100))
    : 0;

  return { appointments, bookedCents, openGaps, utilizationPercent };
}
