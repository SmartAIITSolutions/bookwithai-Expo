import { ownerFetch } from './ownerApi';

export interface OwnerBooking {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  price_cents: number | null;
  total_charged_cents: number | null;
  notes: string | null;
  internal_notes: string | null;
  staff_id: string | null;
  service_id: string | null;
  customer_id: string | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  locked: boolean;
  customer: { id: string; name: string; email: string | null; phone: string | null; priority?: boolean } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
  staff: { id: string; name: string } | null;
}

export async function listBookingsForDate(date: string) {
  return ownerFetch<{ data: OwnerBooking[] }>(`/api/owner/bookings?date=${date}`);
}

export interface PaymentStatusResult {
  online_payment_enabled: boolean;
  statuses: Record<string, boolean>;
}

// Cross-checks each booking's payment against Stripe directly (not just the
// locally-recorded total_charged_cents) so a silently-failed webhook can't
// make a booking look paid when Stripe never actually settled the card.
// `online_payment_enabled` is false when the salon has no Stripe Connect
// account at all -- callers should hide the paid/unpaid flag entirely then.
export async function getPaymentStatusForDate(date: string) {
  return ownerFetch<PaymentStatusResult>(`/api/owner/bookings/payment-status?date=${date}`);
}

export async function createBooking(body: {
  customer_id: string; service_id: string; staff_id?: string | null;
  starts_at: string; ends_at: string; source?: 'manual' | 'walk_in';
}) {
  return ownerFetch('/api/owner/bookings', { method: 'POST', body });
}

export async function updateBooking(id: string, patch: Partial<{
  starts_at: string; ends_at: string; staff_id: string | null;
  status: string; internal_notes: string | null;
  checked_in_at: string | null; service_started_at: string | null; service_completed_at: string | null;
}>) {
  return ownerFetch(`/api/owner/bookings/${id}`, { method: 'PATCH', body: patch });
}

export function checkIn(id: string)            { return updateBooking(id, { checked_in_at: new Date().toISOString() }); }
export function startService(id: string)        { return updateBooking(id, { service_started_at: new Date().toISOString() }); }
export function completeService(id: string)     { return updateBooking(id, { service_completed_at: new Date().toISOString() }); }
export function cancelBooking(id: string)        { return updateBooking(id, { status: 'cancelled' }); }

export function markNoShow(id: string) {
  return ownerFetch(`/api/owner/bookings/${id}/no-show`, { method: 'POST' });
}

export function duplicateBooking(id: string, starts_at: string, ends_at: string) {
  return ownerFetch(`/api/owner/bookings/${id}/duplicate`, { method: 'POST', body: { starts_at, ends_at } });
}

export function setBookingLocked(id: string, locked: boolean) {
  return ownerFetch(`/api/owner/bookings/${id}/lock`, { method: 'PATCH', body: { locked } });
}

export function bulkCancelBookings(bookingIds: string[]) {
  return ownerFetch('/api/owner/bookings/bulk', { method: 'POST', body: { booking_ids: bookingIds, action: 'cancel' } });
}

export function bulkShiftBookings(bookingIds: string[], shiftMinutes: number) {
  return ownerFetch('/api/owner/bookings/bulk', { method: 'POST', body: { booking_ids: bookingIds, action: 'shift', shift_minutes: shiftMinutes } });
}
