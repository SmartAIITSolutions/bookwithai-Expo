import { ownerFetch } from './ownerApi';

export interface CheckoutPreview {
  booking: { id: string; price_cents: number | null };
  tax: { rate_percent: number; inclusive: boolean; label: string };
  pass_stripe_fee: boolean;
  subtotal_cents: number;
  tax_cents: number;
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
  send_receipt_email?: boolean;
  send_receipt_sms?: boolean;
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

export async function refundBooking(bookingId: string, amount_cents: number, reason?: string) {
  return ownerFetch(`/api/owner/bookings/${bookingId}/refund`, { method: 'POST', body: { amount_cents, reason } });
}

export async function getStoreCredit(customerId: string) {
  return ownerFetch<{ balance_cents: number; history: unknown[] }>(`/api/owner/customers/${customerId}/store-credit`);
}
