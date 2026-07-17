import { Colors } from '@/constants/Colors';

export interface BookingLike {
  status: string;
  total_charged_cents: number | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
  starts_at: string;
}

export type StatusLabel =
  | 'Cancelled' | 'No Show' | 'Completed' | 'Paid' | 'Payment Pending'
  | 'In Service' | 'Checked In' | 'Late' | 'Arriving Soon' | 'Confirmed';

// Derives the Phase 0.3 status-color + label from booking state. Never
// colors by service or staff — status only, per the design constitution.
export function bookingStatusColor(b: BookingLike): { color: string; label: StatusLabel } {
  if (b.status === 'cancelled')  return { color: Colors.textDisabled,      label: 'Cancelled' };
  if (b.status === 'no_show')    return { color: Colors.statusLate,        label: 'No Show' };
  if (b.status === 'completed')  return { color: Colors.statusCompleted,   label: 'Completed' };

  const paid = (b.total_charged_cents ?? 0) > 0;

  if (b.service_completed_at) return paid
    ? { color: Colors.statusPaid,           label: 'Paid' }
    : { color: Colors.statusPaymentPending, label: 'Payment Pending' };

  if (b.service_started_at) return { color: Colors.statusInService, label: 'In Service' };
  if (b.checked_in_at)      return { color: Colors.statusCheckedIn, label: 'Checked In' };

  const minutesUntil = (new Date(b.starts_at).getTime() - Date.now()) / 60000;
  if (minutesUntil < -10) return { color: Colors.statusLate,        label: 'Late' };
  if (minutesUntil < 30)  return { color: Colors.statusArrivingSoon, label: 'Arriving Soon' };

  return { color: Colors.primary, label: 'Confirmed' };
}

// The Phase 0.4/0.6 sticky action bar — the one next action the current
// state calls for. READY FOR CHECKOUT now opens real Checkout Mode
// (Sprint 4) instead of the Sprint 2 placeholder disabled state.
export function nextAction(b: BookingLike): { label: string; disabled?: boolean } | null {
  if (b.status === 'cancelled' || b.status === 'no_show') return null;
  if (b.status === 'completed') return { label: 'BOOK NEXT APPOINTMENT' };
  if (b.service_completed_at) return { label: 'READY FOR CHECKOUT' };
  if (b.service_started_at)   return { label: 'MARK SERVICE COMPLETE' };
  if (b.checked_in_at)        return { label: 'START SERVICE' };
  return { label: 'CHECK IN' };
}
