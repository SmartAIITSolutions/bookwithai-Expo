import { OwnerBooking } from '@/lib/api/ownerBookings';
import { CalendarPalette as P } from '@/constants/CalendarPalette';
import i18n from '@/lib/i18n';

export type BookingSource = 'sanaa' | 'online' | 'walk_in' | 'manual' | 'block' | 'other';

// Card identity (Part 4/10A/31) — booking.source is the one authoritative
// field (confirmed live in production: online/manual/mobile/time_block/
// walk_in/voice_ai). 'mobile' is grouped under 'other' (neutral) rather than
// guessed into online/manual -- the investigation could not confirm with
// confidence which code path sets it, and the spec is explicit: "If source
// cannot be confidently identified: use neutral treatment. Do not invent
// source."
export function bookingSource(b: Pick<OwnerBooking, 'source'>): BookingSource {
  switch (b.source) {
    case 'voice_ai':   return 'sanaa';
    case 'online':      return 'online';
    case 'walk_in':     return 'walk_in';
    case 'manual':      return 'manual';
    case 'time_block':  return 'block';
    default:            return 'other';
  }
}

export const SOURCE_COLOR: Record<BookingSource, string> = {
  sanaa:   P.sourceSanaa,
  online:  P.sourceOnline,
  walk_in: P.sourceWalkIn,
  manual:  P.sourceManual,
  block:   P.sourceBlock,
  other:   P.textDisabled,
};

export const SOURCE_LABEL: Record<BookingSource, string> = {
  sanaa: 'SANAA Booking', online: 'Online Booking', walk_in: 'Walk-in',
  manual: 'Manual', block: 'Blocked Time', other: '',
};

export type PaymentBadge = 'paid' | 'unpaid' | 'deposit' | null;

// Payment indicator (Part 8/10C) — deliberately LOCAL evidence only, never
// a live Stripe call per card (that cost is real, and belongs to the
// detail/checkout flow's own already-existing Stripe-verified check, not a
// grid of N cards). `total_charged_cents` vs `price_cents` are both already
// selected by GET /api/owner/bookings — a straightforward numeric
// comparison of two real columns, not a guess. "Deposit" specifically means
// "something has been charged, but not the full price" -- reliable enough
// for a grid-level indicator per the spec's own local-evidence allowance;
// still not Stripe-verified, which is why the same booking's authoritative
// paid/unpaid state is re-checked properly inside Checkout/AppointmentSheet
// rather than trusted blindly from here for any money-moving decision.
export function paymentBadge(b: Pick<OwnerBooking, 'price_cents' | 'total_charged_cents' | 'status' | 'source'>): PaymentBadge {
  if (b.status === 'cancelled' || b.status === 'no_show') return null;
  if (b.source === 'time_block') return null;
  const price = b.price_cents ?? 0;
  if (price <= 0) return null;
  const charged = b.total_charged_cents ?? 0;
  if (charged <= 0) return 'unpaid';
  if (charged < price) return 'deposit';
  return 'paid';
}

export const PAYMENT_COLOR: Record<Exclude<PaymentBadge, null>, string> = {
  paid: P.success, unpaid: P.warning, deposit: P.darkGold,
};
// i18n foundation (L5B) -- same standalone-i18next pattern as
// bookingStatus.ts's statusLabel()/actionLabel() (a plain utility function,
// not a component/hook). Kept as a function (not a Record) so the label
// resolves fresh against the current language on every call.
export function paymentLabel(badge: Exclude<PaymentBadge, null>): string {
  const K = { paid: 'calendar:timeline.paidPill', unpaid: 'calendar:timeline.unpaidPill', deposit: 'calendar:timeline.depositPill' } as const;
  return i18n.t(K[badge]);
}

// The single top-right status pill (Part 10) — a cancelled/no-show booking
// shows its terminal operational status there instead of a payment state
// (payment is moot once a booking is cancelled or never showed).
export type PrimaryPill =
  | { kind: 'cancelled' } | { kind: 'no_show' } | { kind: 'payment'; badge: Exclude<PaymentBadge, null> } | null;

export function primaryPill(b: Pick<OwnerBooking, 'status' | 'price_cents' | 'total_charged_cents' | 'source'>): PrimaryPill {
  if (b.status === 'cancelled') return { kind: 'cancelled' };
  if (b.status === 'no_show') return { kind: 'no_show' };
  const pay = paymentBadge(b);
  return pay ? { kind: 'payment', badge: pay } : null;
}

// The small corner icon (Part 10B, unified with source per the reference's
// own visible cards -- see Day View investigation notes) -- operational
// states that are more urgent than "which channel booked this" take
// priority over the plain source icon in that same visual slot, matching
// the Legend's own Status icon set. Reuses bookingStatusColor's existing
// derivation rather than re-deriving status separately.
export type CornerIcon =
  | { kind: 'source'; source: BookingSource }
  | { kind: 'status'; status: 'checked_in' | 'in_service' | 'late' | 'no_show' | 'cancelled' };

export function cornerIcon(b: OwnerBooking): CornerIcon {
  if (b.status === 'cancelled') return { kind: 'status', status: 'cancelled' };
  if (b.status === 'no_show') return { kind: 'status', status: 'no_show' };
  if (b.service_started_at && !b.service_completed_at) return { kind: 'status', status: 'in_service' };
  if (b.checked_in_at) return { kind: 'status', status: 'checked_in' };
  const minutesUntil = (new Date(b.starts_at).getTime() - Date.now()) / 60000;
  if (minutesUntil < -10 && !b.service_started_at && !b.checked_in_at) return { kind: 'status', status: 'late' };
  return { kind: 'source', source: bookingSource(b) };
}
