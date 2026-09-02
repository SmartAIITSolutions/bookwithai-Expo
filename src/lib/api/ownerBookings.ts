import { ownerFetch } from './ownerApi';
import i18n from '@/lib/i18n';

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
  service_line_ids?: string[] | null;
  customer_id: string | null;
  // Set instead of customer_id for a true walk-in with no name/phone/email
  // captured -- free-text label stored directly on the booking.
  walk_in_label?: string | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  locked: boolean;
  customer: {
    id: string; name: string; email: string | null; phone: string | null; priority?: boolean;
    // Calendar 2.0 Part 14 — new-vs-returning. total_bookings counts every
    // booking this customer has ever had at this salon (customers.
    // total_bookings, maintained server-side); this booking itself is
    // always included in that count by the time it's fetched, so
    // "returning" means >1, not >0.
    total_bookings?: number;
  } | null;
  service: { id: string; name: string; duration_minutes: number } | null;
  staff: { id: string; name: string } | null;
  // Resolved server-side from either the singular `service` join or
  // `service_line_ids` (multi-service bookings from the public booking
  // widget often have `service_id` null and only the line-ids array set,
  // in which case `service` above is null but this still has real names).
  service_names?: string[];
}

// i18n foundation (L2) — 'Service'/'Customer' below are app-owned FALLBACK
// copy (shown only when there's no real service/customer data), not
// user-generated content -- safe and correct to translate, unlike
// b.service?.name/b.customer?.name themselves (salon-entered data, never
// machine-translated). Uses the standalone i18next instance directly since
// these are plain utility functions called from many components' render
// bodies, not components/hooks themselves.
export function serviceDisplayName(b: Pick<OwnerBooking, 'service' | 'service_names'>): string {
  if (b.service_names && b.service_names.length > 0) return b.service_names.join(' + ');
  return b.service?.name ?? i18n.t('common:serviceFallback');
}

export function customerDisplayName(b: Pick<OwnerBooking, 'customer' | 'walk_in_label'>): string {
  if (b.customer?.name) return b.customer.name;
  // Presentation-only translation: 'Walk-in' is the literal default
  // WalkInSheet persists to walk_in_label when the owner didn't type a
  // custom label (see its own comment on that field) -- it's the generic
  // filler value, not a business-authored name, so it's safe to translate
  // for display. The stored bookings.walk_in_label value itself is never
  // touched; a genuinely custom label the owner typed passes through as-is.
  if (b.walk_in_label === 'Walk-in') return i18n.t('calendar:screen.walkIn');
  return b.walk_in_label ?? i18n.t('common:customerFallback');
}

export async function listBookingsForDate(date: string) {
  return ownerFetch<{ data: OwnerBooking[] }>(`/api/owner/bookings?date=${date}`);
}

// Fetches a single booking's full record -- needed when a screen only has a
// lightweight summary (e.g. Dashboard's Recent Activity) but wants to open
// the real Appointment Sheet, which needs the full OwnerBooking shape.
export async function getBooking(id: string) {
  return ownerFetch<{ data: OwnerBooking }>(`/api/owner/bookings/${id}`);
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

export interface UpcomingActivityItem {
  booking_id: string;
  customer_name: string;
  service_names: string[];
  starts_at: string;
  amount_cents: number;
  paid?: boolean;
}

export interface UpcomingActivityResult {
  online_payment_enabled: boolean;
  data: UpcomingActivityItem[];
}

// Dashboard's "Recent Activity" — one card per upcoming (not past, not
// cancelled) booking that had recent activity, reframed around the
// appointment itself: customer, service, amount, and a real Stripe-verified
// paid/unpaid flag, rather than raw notification text.
export async function getUpcomingActivity(limit = 6) {
  return ownerFetch<UpcomingActivityResult>(`/api/owner/dashboard/upcoming-activity?limit=${limit}`);
}

export async function createBooking(body: {
  // Exactly one of customer_id / walk_in_label -- a real customer, or a
  // true walk-in with no name/phone/email captured (free-text label
  // stored directly on the booking instead).
  customer_id?: string | null; walk_in_label?: string | null;
  // service_id is single-service back-compat; service_ids is the
  // multi-service cart (order = quantity, duplicates allowed for e.g. two
  // people getting the same service in one walk-in) -- prefer this.
  service_id?: string; service_ids?: string[];
  staff_id?: string | null;
  starts_at: string; ends_at: string; source?: 'manual' | 'walk_in';
  // Set once the owner has explicitly confirmed a "double-book anyway?"
  // prompt -- skips the server's staff-conflict check for this request only.
  override_conflict?: boolean;
}) {
  return ownerFetch('/api/owner/bookings', { method: 'POST', body });
}

export async function updateBooking(id: string, patch: Partial<{
  starts_at: string; ends_at: string; staff_id: string | null;
  status: string; internal_notes: string | null;
  service_line_ids: string[] | null; price_cents: number | null;
  checked_in_at: string | null; service_started_at: string | null; service_completed_at: string | null;
  override_conflict: boolean;
}>) {
  return ownerFetch(`/api/owner/bookings/${id}`, { method: 'PATCH', body: patch });
}

export function checkIn(id: string)            { return updateBooking(id, { checked_in_at: new Date().toISOString() }); }
export function startService(id: string)        { return updateBooking(id, { service_started_at: new Date().toISOString() }); }
export function completeService(id: string)     { return updateBooking(id, { service_completed_at: new Date().toISOString() }); }

// Quick Flow's single action -- collapses Check In / Start Service / Mark
// Complete into one PATCH for salons with no handoff between steps to track.
export function completeAndReadyForCheckout(id: string) {
  const now = new Date().toISOString();
  return updateBooking(id, { checked_in_at: now, service_started_at: now, service_completed_at: now });
}
export function cancelBooking(id: string)        { return updateBooking(id, { status: 'cancelled' }); }

export function markNoShow(id: string) {
  return ownerFetch(`/api/owner/bookings/${id}/no-show`, { method: 'POST' });
}

export function duplicateBooking(id: string, starts_at: string, ends_at: string, overrideConflict?: boolean) {
  return ownerFetch(`/api/owner/bookings/${id}/duplicate`, { method: 'POST', body: { starts_at, ends_at, override_conflict: overrideConflict } });
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

// Calendar 2.0 Day View — Block Time. Reuses the exact same bookings-table
// mechanism the web dashboard already uses (source='time_block', no
// customer/service, price_cents=0) via a dedicated owner-auth route, since
// the web dashboard's own POST /api/bookings authenticates by cookie
// session and can't be called from this app's Bearer-token auth.
// Calendar 2.0 — the conflict check is a warning the owner can override
// (override_conflict), not a hard rejection: a block deliberately can
// overlap real appointments (they're never touched). When the server
// returns a conflict without override_conflict set, ownerFetch's error
// branch now carries the route's own extra body fields (conflictCount/
// conflicts) straight through -- callers read them off the error result
// (see submitBlockTime in calendar.tsx).
export interface BlockTimeConflict { starts_at: string; label: string }
export function blockTime(body: {
  starts_at: string; block_duration_minutes: number; staff_id?: string | null; notes?: string | null;
  override_conflict?: boolean;
}) {
  return ownerFetch<{ data: { id: string }; conflictCount?: number; conflicts?: BlockTimeConflict[] }>(
    '/api/owner/bookings/block', { method: 'POST', body },
  );
}

// Bottom-edge resize (Calendar 2.0) — a duration-only change. Deliberately
// sends ONLY ends_at, never starts_at: PATCH /api/owner/bookings/[id]'s own
// wasRescheduled check is gated on starts_at actually changing, so this
// never fires the customer "your appointment has been rescheduled"
// notification -- confirmed by reading that route before relying on it,
// not assumed. Still goes through the same conflict check and respects
// `locked`, since ends_at counts toward "movingOrReassigning" there too.
export function resizeBooking(id: string, newEndsAt: string, overrideConflict?: boolean) {
  return updateBooking(id, { ends_at: newEndsAt, ...(overrideConflict ? { override_conflict: true } : {}) });
}
