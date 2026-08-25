import { OwnerBooking } from '@/lib/api/ownerBookings';

// Calendar 2.0 Day View — Parts 35/36. Deterministic, pure client-side
// fixture data so every designed appointment/card state can be visually
// exercised without touching production data. Never inserted into
// Supabase, never sent to any API, never generates a push/SMS/email, never
// touches Stripe/Telnyx/SANAA minutes -- these are plain in-memory
// OwnerBooking objects, indistinguishable to the rest of the app from a
// real fetch result only because they satisfy the same TypeScript shape;
// they are never written anywhere.
//
// Toggle lives entirely in AsyncStorage on-device (see useDaySampleMode);
// __DEV__-gated at every call site, same convention already used by this
// app's other dev-only state switchers (getDevSanaaStateOverride).

// Calendar 2.0 correction pass — every fixture booking below is built with
// base()/buildLateSampleBooking()'s own id scheme (`sample-<n>` /
// `sample-late-<n>`), never anything else. This is the ONE place that
// contract is defined, so this is also the one place that recognizes it --
// callers check `isSampleBooking(booking.id)` instead of re-deriving the
// same rule from booking shape/properties, which would drift the moment
// this file's own id scheme changed.
export function isSampleBooking(id: string): boolean {
  return id.startsWith('sample-');
}

function customer(name: string, opts?: { priority?: boolean; totalBookings?: number; avatar?: boolean }): OwnerBooking['customer'] {
  return {
    id: `sample-cust-${name.replace(/\s+/g, '-').toLowerCase()}`,
    name,
    email: null,
    phone: null,
    priority: !!opts?.priority,
    total_bookings: opts?.totalBookings ?? 3,
  };
}

function service(name: string, minutes: number): OwnerBooking['service'] {
  return { id: `sample-svc-${name.replace(/\s+/g, '-').toLowerCase()}`, name, duration_minutes: minutes };
}

function staffRef(name: string): { id: string; name: string } {
  return { id: `sample-staff-${name.toLowerCase()}`, name };
}

let seq = 0;
function base(dayBase: Date, startMin: number, durationMin: number): Pick<OwnerBooking, 'id' | 'starts_at' | 'ends_at'> {
  seq += 1;
  const start = new Date(dayBase.getTime() + startMin * 60000);
  const end = new Date(start.getTime() + durationMin * 60000);
  return { id: `sample-${seq}`, starts_at: start.toISOString(), ends_at: end.toISOString() };
}

// Builds one full sample day, times relative to `dayBase` (local midnight of
// the currently-displayed date) so the fixture always lands on "today" no
// matter when it's viewed -- matching the reference's own 8 AM–7 PM spread.
export function buildSampleDay(dayBase: Date): OwnerBooking[] {
  seq = 0;
  const mk = (
    startMin: number, durationMin: number,
    fields: Partial<OwnerBooking>,
  ): OwnerBooking => ({
    ...base(dayBase, startMin, durationMin),
    status: 'confirmed',
    source: 'manual',
    price_cents: null,
    total_charged_cents: null,
    notes: null,
    internal_notes: null,
    staff_id: null,
    service_id: null,
    customer_id: null,
    checked_in_at: null,
    service_started_at: null,
    service_completed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    locked: false,
    customer: null,
    service: null,
    staff: null,
    ...fields,
  });

  const tina = staffRef('Tina');

  return [
    // 1. Blocked Time — early personal block
    mk(8 * 60, 30, {
      source: 'time_block', price_cents: 0, staff_id: tina.id, staff: tina,
      internal_notes: 'Personal Time',
    }),

    // 2. SANAA booking, paid, 30m
    mk(9 * 60, 30, {
      source: 'voice_ai', price_cents: 1500, total_charged_cents: 1500,
      customer: customer('Emma K.', { totalBookings: 1 }),
      service: service('Eyebrow Threading', 30), staff_id: tina.id, staff: tina,
    }),

    // 3. Online booking, unpaid, 30m
    mk(10 * 60, 30, {
      source: 'online', price_cents: 2000, total_charged_cents: 0,
      customer: customer('Keona Z.', { totalBookings: 4 }),
      service: service('Brow Tint', 30), staff_id: tina.id, staff: tina,
    }),

    // 4. Walk-in, paid, 45m — new client (first visit)
    mk(11 * 60 + 15, 45, {
      source: 'walk_in', price_cents: 3500, total_charged_cents: 3500,
      customer: customer('Reymah Smith', { totalBookings: 1 }),
      service: service('Threading + Tint', 45), staff_id: tina.id, staff: tina,
    }),

    // (12:00–12:45 intentionally left open — the Smart Gap example)

    // 5. SANAA booking, deposit only (partial), 60m, VIP client
    mk(13 * 60, 60, {
      source: 'voice_ai', price_cents: 6000, total_charged_cents: 2000,
      customer: customer('Sarah M.', { priority: true, totalBookings: 8 }),
      service: service('Brow Lamination', 60), staff_id: tina.id, staff: tina,
    }),

    // 6. Walk-in, paid, 45m — checked in + in service example
    mk(14 * 60 + 30, 45, {
      source: 'walk_in', price_cents: 2500, total_charged_cents: 2500,
      customer: customer('Tina R.', { totalBookings: 6 }),
      service: service('Full Face Threading', 45), staff_id: tina.id, staff: tina,
      checked_in_at: new Date(dayBase.getTime() + (14 * 60 + 30 - 10) * 60000).toISOString(),
      service_started_at: new Date(dayBase.getTime() + (14 * 60 + 30 - 2) * 60000).toISOString(),
    }),

    // 7. Online, unpaid, 45m
    mk(15 * 60 + 30, 45, {
      source: 'online', price_cents: 2000, total_charged_cents: 0,
      customer: customer('Tracy L.', { totalBookings: 2 }),
      service: service('Eyebrow + Upper Lip', 45), staff_id: tina.id, staff: tina,
    }),

    // 8. Cancelled, 30m
    mk(16 * 60 + 30, 30, {
      status: 'cancelled', source: 'online', price_cents: 2000, total_charged_cents: 0,
      customer: customer('Linda P.', { totalBookings: 3 }),
      service: service('Brow Tint', 30), staff_id: tina.id, staff: tina,
      cancelled_at: new Date().toISOString(), cancellation_reason: 'Customer requested',
    }),

    // 9. No-show, 45m
    mk(17 * 60 + 15, 45, {
      status: 'no_show', source: 'manual', price_cents: 3500, total_charged_cents: 0,
      customer: customer('Monica R.', { totalBookings: 5 }),
      service: service('Threading + Tint', 45), staff_id: tina.id, staff: tina,
    }),

    // 10. Blocked Time — end of day cleanup
    mk(18 * 60, 60, {
      source: 'time_block', price_cents: 0, staff_id: tina.id, staff: tina,
      internal_notes: 'End of day cleanup',
    }),

    // 11. Overlap example — a second staff double-booked at the same time as #2,
    // demonstrating the existing side-by-side overlap layout still works
    // with the new card visual system.
    mk(9 * 60, 30, {
      source: 'manual', price_cents: 1800, total_charged_cents: 1800,
      customer: customer('Priya D.', { totalBookings: 2 }),
      service: service('Lash Tint', 30), staff_id: 'sample-staff-mo', staff: staffRef('Mo'),
    }),

    // 12. Completed — a distinct `status` value (not just paid+past), so
    // anything reading booking.status directly (not just the grid card's
    // own paid/unpaid pill) has a real example to exercise.
    mk(8 * 60 + 30, 30, {
      status: 'completed', source: 'walk_in', price_cents: 2000, total_charged_cents: 2000,
      customer: customer('Grace H.', { totalBookings: 7 }),
      service: service('Brow Tint', 30), staff_id: tina.id, staff: tina,
      checked_in_at: new Date(dayBase.getTime() + (8 * 60 + 25) * 60000).toISOString(),
      service_started_at: new Date(dayBase.getTime() + (8 * 60 + 30) * 60000).toISOString(),
      service_completed_at: new Date(dayBase.getTime() + (8 * 60 + 58) * 60000).toISOString(),
    }),
  ];
}

// Late (Calendar 2.0 Part 10B/25) is computed relative to the real current
// time (bookingStatusColor/cornerIcon: starts_at more than 10 minutes in
// the past with no check-in), not to the fixture's own fixed 8 AM–7 PM
// schedule -- a fixed-offset fixture item would only happen to read as
// "Late" when tested at the right moment of day. Anchoring this one item to
// real now() instead guarantees it's actually demonstrated whenever sample
// mode is on, regardless of when that is.
export function buildLateSampleBooking(): OwnerBooking {
  seq += 1;
  const start = new Date(Date.now() - 25 * 60000);
  const end = new Date(start.getTime() + 30 * 60000);
  return {
    id: `sample-late-${seq}`, starts_at: start.toISOString(), ends_at: end.toISOString(),
    status: 'confirmed', source: 'manual', price_cents: 2500, total_charged_cents: 0,
    notes: null, internal_notes: null, service_line_ids: null,
    staff_id: 'sample-staff-tina', service_id: null, customer_id: null,
    checked_in_at: null, service_started_at: null, service_completed_at: null,
    cancelled_at: null, cancellation_reason: null, locked: false,
    customer: customer('Late Client', { totalBookings: 2 }),
    service: service('Threading', 30), staff: staffRef('Tina'),
  };
}

