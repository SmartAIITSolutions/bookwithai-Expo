import { Colors } from '@/constants/Colors';
import i18n from '@/lib/i18n';

export interface BookingLike {
  status: string;
  total_charged_cents: number | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
  starts_at: string;
}

// i18n foundation (L2) — was a union of the literal English display strings
// themselves (StatusLabel), used as bookingStatusColor()'s return type. Now
// that the label is a real translated string, it can no longer be a
// literal-string union (a Spanish "Cancelada" isn't one of the English
// literals) -- decoupled to plain `string`, exactly per L0's own note that
// this type would need decoupling before localization. StatusKey (below)
// remains the real, unchanged canonical discriminant.
export type StatusLabel = string;

// i18n foundation (L1) — the stable, canonical discriminant for a booking's
// derived status. StatusLabel above is a DISPLAY string (translated as of
// L2); it must never be compared against to drive behavior -- that was
// exactly the bug found at dashboard.tsx's old `status.label === 'Confirmed'`
// check. Code should compare against StatusKey instead; bookingStatusColor()'s
// label/color stay purely presentational, derived FROM the key below.
export type StatusKey =
  | 'cancelled' | 'no_show' | 'completed' | 'paid' | 'payment_pending'
  | 'in_service' | 'checked_in' | 'late' | 'arriving_soon' | 'confirmed' | 'pending';

// i18n foundation (L2) — resolves the translated label for a given
// StatusKey. Uses the standalone i18next instance directly (not the
// useTranslation() hook) because bookingStatusColor()/bookingStatusKey()
// are plain utility functions called from many components' render bodies,
// not components/hooks themselves -- the same, officially-supported
// outside-of-React i18next usage pattern already used for
// customerDisplayName()/serviceDisplayName() (see ownerBookings.ts).
// Exported (was module-private) so the Calendar filter sheet's Status
// section can list every real StatusKey with its exact existing label/color
// instead of inventing a second, parallel copy of this same taxonomy.
export function statusLabel(key: StatusKey): string {
  const K = {
    cancelled: 'common:status.cancelled', no_show: 'common:status.noShow', completed: 'common:status.completed',
    paid: 'common:status.paid', payment_pending: 'common:status.paymentPending', in_service: 'common:status.inService',
    checked_in: 'common:status.checkedIn', late: 'common:status.late', arriving_soon: 'common:status.arrivingSoon',
    confirmed: 'common:status.confirmed', pending: 'common:status.pending',
  } as const;
  return i18n.t(K[key]);
}
export const ALL_STATUS_KEYS: StatusKey[] = [
  'confirmed', 'pending', 'arriving_soon', 'checked_in', 'in_service', 'late',
  'payment_pending', 'paid', 'completed', 'no_show', 'cancelled',
];
export const STATUS_COLOR: Record<StatusKey, string> = {
  cancelled: Colors.textDisabled, no_show: Colors.statusLate, completed: Colors.statusCompleted,
  paid: Colors.statusPaid, payment_pending: Colors.statusPaymentPending, in_service: Colors.statusInService,
  checked_in: Colors.statusCheckedIn, late: Colors.statusLate, arriving_soon: Colors.statusArrivingSoon,
  confirmed: Colors.primary, pending: Colors.statusArrivingSoon,
};

// Same branch order/conditions as before this split -- moved here, once, so
// bookingStatusColor() (below) and any other future caller needing the
// canonical key (e.g. dashboard.tsx) never have to re-derive it, and can
// never drift out of sync with each other.
export function bookingStatusKey(b: BookingLike): StatusKey {
  if (b.status === 'cancelled')  return 'cancelled';
  if (b.status === 'no_show')    return 'no_show';
  if (b.status === 'completed')  return 'completed';

  const paid = (b.total_charged_cents ?? 0) > 0;

  if (b.service_completed_at) return paid ? 'paid' : 'payment_pending';

  if (b.service_started_at) return 'in_service';
  if (b.checked_in_at)      return 'checked_in';

  const minutesUntil = (new Date(b.starts_at).getTime() - Date.now()) / 60000;
  if (minutesUntil < -10) return 'late';
  if (minutesUntil < 30)  return 'arriving_soon';

  // "confirmed" is a claim about the booking's actual `status` value, not
  // just "nothing else applies yet" -- a booking still sitting at the
  // auto-assigned 'pending' status (unpaid at creation, never flipped by
  // anyone) hasn't genuinely been confirmed by the customer or the salon.
  if (b.status === 'pending') return 'pending';
  return 'confirmed';
}

// Derives the Phase 0.3 status-color + label from booking state. Never
// colors by service or staff — status only, per the design constitution.
export function bookingStatusColor(b: BookingLike): { color: string; label: StatusLabel } {
  const key = bookingStatusKey(b);
  return { color: STATUS_COLOR[key], label: statusLabel(key) };
}

// Rebook-nudge attribution accent -- deliberately kept OUT of
// bookingStatusColor's own logic above (that stays status-only, per its own
// constitution comment). Call sites that render a booking's color check
// `booking.source` separately and swap this accent in for the dot/border
// while leaving the real status label untouched, so a nudge-driven booking
// is visually flagged on the calendar without pretending to be a status.
export const REBOOK_NUDGE_COLOR = '#EC4899';
export function isRebookNudgeBooking(b: { source?: string | null }): boolean {
  return b.source === 'rebook_nudge';
}

export type CheckinFlowMode = 'full' | 'quick';

// i18n foundation (L1) — same category as StatusKey above: the stable,
// canonical discriminant callers must compare against. `label` stays the
// display string (translated as of L2); it was previously the ONLY thing
// call sites compared against ("action.label === 'CHECK IN'" in
// AppointmentSheet.tsx/TimelineCalendar.tsx), which would have silently
// broken booking check-in/start/complete/checkout dispatch the moment
// these labels were ever translated. Values/behavior below are byte-for-
// byte the same as before this split -- only the key is new.
export type ActionKey =
  | 'check_in' | 'start_service' | 'mark_complete' | 'complete_and_charge'
  | 'ready_for_checkout' | 'book_next_appointment';

// i18n foundation (L2) — same standalone-i18next pattern as statusLabel()
// above, for the same reason (nextAction() is a plain utility function).
// `as const` (not a `Record<ActionKey, string>` annotation) keeps each
// value a literal type, which is what lets i18next's own TypeScript
// key-safety (src/lib/i18n/i18next.d.ts, L1) actually check these calls.
const ACTION_LABEL_KEY = {
  check_in: 'common:actions.checkIn', start_service: 'common:actions.startService',
  mark_complete: 'common:actions.markComplete', complete_and_charge: 'common:actions.completeAndCharge',
  ready_for_checkout: 'common:actions.readyForCheckout', book_next_appointment: 'common:actions.bookNextAppointment',
} as const;
function actionLabel(key: ActionKey): string {
  return i18n.t(ACTION_LABEL_KEY[key]);
}

// The Phase 0.4/0.6 sticky action bar — the one next action the current
// state calls for. READY FOR CHECKOUT now opens real Checkout Mode
// (Sprint 4) instead of the Sprint 2 placeholder disabled state.
//
// flowMode 'quick' collapses Check In / Start Service / Mark Complete into a
// single COMPLETE & CHARGE action -- for solo/home-based salons where
// there's no one to hand the client off between steps to. Once a booking
// already has service_completed_at set (e.g. the salon switched modes
// mid-day), the normal READY FOR CHECKOUT / BOOK NEXT APPOINTMENT tail end
// of the flow still applies unchanged in either mode.
export function nextAction(b: BookingLike, flowMode: CheckinFlowMode = 'full'): { key: ActionKey; label: string; disabled?: boolean } | null {
  if (b.status === 'cancelled' || b.status === 'no_show') return null;
  if (b.status === 'completed') return { key: 'book_next_appointment', label: actionLabel('book_next_appointment') };
  if (b.service_completed_at) return { key: 'ready_for_checkout', label: actionLabel('ready_for_checkout') };
  if (flowMode === 'quick') return { key: 'complete_and_charge', label: actionLabel('complete_and_charge') };
  if (b.service_started_at)   return { key: 'mark_complete', label: actionLabel('mark_complete') };
  if (b.checked_in_at)        return { key: 'start_service', label: actionLabel('start_service') };
  return { key: 'check_in', label: actionLabel('check_in') };
}
