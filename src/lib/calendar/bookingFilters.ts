import { OwnerBooking } from '@/lib/api/ownerBookings';
import { bookingSource, BookingSource, paymentBadge, PaymentBadge } from './appointmentVisual';
import { bookingStatusKey, StatusKey } from './bookingStatus';

// Calendar parity pass (audit §08) — Fresha has 8 independent filter
// dimensions; this covers the 4 the audit scoped as the next fix (status,
// channel, payment status, services), layered on top of the existing staff
// filter which already lived in calendar.tsx before this. Each dimension is
// a Set: empty = "no filter on this axis" (show everything), non-empty =
// OR within the axis, AND across axes -- e.g. checking "SANAA" + "Walk-in"
// under Channel and "Unpaid" under Payment shows (SANAA OR Walk-in) AND
// Unpaid, matching how Fresha's own multi-select filter chips behave.
export interface CalendarFilters {
  statuses: Set<StatusKey>;
  channels: Set<BookingSource>;
  payment: Set<Exclude<PaymentBadge, null>>;
  serviceIds: Set<string>;
}

export function emptyFilters(): CalendarFilters {
  return { statuses: new Set(), channels: new Set(), payment: new Set(), serviceIds: new Set() };
}

export function isFiltersActive(f: CalendarFilters): boolean {
  return f.statuses.size > 0 || f.channels.size > 0 || f.payment.size > 0 || f.serviceIds.size > 0;
}

export function activeFilterCount(f: CalendarFilters): number {
  return f.statuses.size + f.channels.size + f.payment.size + f.serviceIds.size;
}

export function bookingMatchesFilters(b: OwnerBooking, f: CalendarFilters): boolean {
  if (f.statuses.size > 0 && !f.statuses.has(bookingStatusKey(b))) return false;
  if (f.channels.size > 0 && !f.channels.has(bookingSource(b))) return false;
  if (f.payment.size > 0) {
    const badge = paymentBadge(b);
    if (!badge || !f.payment.has(badge)) return false;
  }
  if (f.serviceIds.size > 0) {
    const ids = (b.service_line_ids && b.service_line_ids.length > 0) ? b.service_line_ids : (b.service_id ? [b.service_id] : []);
    if (!ids.some(id => f.serviceIds.has(id))) return false;
  }
  return true;
}
