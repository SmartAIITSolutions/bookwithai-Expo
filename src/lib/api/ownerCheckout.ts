import { ownerFetch } from './ownerApi';

export interface CheckoutPreview {
  booking: { id: string; price_cents: number | null };
  tax: { rate_percent: number; inclusive: boolean; label: string };
  pass_stripe_fee: boolean;
  subtotal_cents: number;
  tax_cents: number;
  // Non-zero when the customer already paid something online at booking
  // time (e.g. a deposit) -- used to default the first tender to "card".
  already_paid_cents: number;
  checklist: { label: string; ok: boolean }[];
  rebook_suggestion: { starts_at: string; interval_days: number } | null;
}

export interface Tender {
  method: 'cash' | 'card' | 'venmo' | 'zelle' | 'cashapp' | 'other' | 'gift_card' | 'store_credit';
  amount_cents: number;
  gift_card_code?: string;
}

export interface ProductLine {
  product_id: string | null;
  product_name: string;
  quantity: number;
  price_cents_each: number;
}

export interface CheckoutRequest {
  tip_cents: number;
  discount_cents: number;
  tax_cents: number;
  products: ProductLine[];
  tenders: Tender[];
  // SMS receipts were removed -- an in-app push receipt now always sends.
  send_receipt_email?: boolean;
  // Extra services performed during this visit, additive to the booking's
  // own service (not a swap). total_service_price_cents is the combined
  // price across the original service plus every added one.
  added_service_ids?: string[];
  total_service_price_cents?: number;
  // Only sent when it differs from the booking's own staff_id -- corrects
  // who actually performed the service, so commission credits them instead.
  staff_id?: string | null;
}

export interface CheckoutResult {
  status: 'completed' | 'awaiting_card_payment';
  total_charged_cents?: number;
  payment_url?: string;
}

export async function getCheckoutPreview(bookingId: string) {
  return ownerFetch<CheckoutPreview>(`/api/owner/bookings/${bookingId}/checkout-preview`);
}

export async function submitCheckout(bookingId: string, body: CheckoutRequest) {
  return ownerFetch<CheckoutResult>(`/api/owner/bookings/${bookingId}/checkout`, { method: 'POST', body });
}

export async function sendBalancePaymentEmail(bookingId: string, paymentUrl: string, visitDueCents: number, cardTotalCents: number) {
  return ownerFetch<{ ok: true }>(`/api/owner/bookings/${bookingId}/balance-payment-email`, {
    method: 'POST',
    body: { payment_url: paymentUrl, visit_due_cents: visitDueCents, card_total_cents: cardTotalCents },
  });
}

export async function sendBalancePaymentPush(bookingId: string, paymentUrl: string, cardTotalCents: number) {
  return ownerFetch<{ ok: true }>(`/api/owner/bookings/${bookingId}/balance-payment-push`, {
    method: 'POST',
    body: { payment_url: paymentUrl, card_total_cents: cardTotalCents },
  });
}

// Fallback "grab your next spot" push -- server-side no-ops if one was
// already sent for this booking, so it's safe to call unconditionally
// whenever checkout completes without an inline rebook.
export async function sendRebookNudge(bookingId: string) {
  return ownerFetch<{ ok: true }>(`/api/owner/bookings/${bookingId}/rebook-nudge`, { method: 'POST' });
}

export async function refundBooking(bookingId: string, amount_cents: number, reason?: string) {
  return ownerFetch(`/api/owner/bookings/${bookingId}/refund`, { method: 'POST', body: { amount_cents, reason } });
}

export async function getStoreCredit(customerId: string) {
  return ownerFetch<{ balance_cents: number; history: unknown[] }>(`/api/owner/customers/${customerId}/store-credit`);
}
