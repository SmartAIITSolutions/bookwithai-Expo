import { ownerFetch } from './ownerApi';

export interface SanaaVoicePlan {
  id: string;
  name: string;
  monthly_price_cents: number;
  included_minutes: number;
  overage_rate_cents_per_min: number;
  activation_fee_cents: number;
}

export interface SanaaFoundingOffer {
  campaign_id: string;
  name: string;
  description: string | null;
  experience_price_cents: number;
  experience_minutes_cap: number;
  experience_days_cap: number;
  activation_fee_cents: number;
  activation_fee_waiver_cycles: number;
  plan_prices: { voice_plan_id: string; monthly_price_override_cents: number }[];
}

export interface SanaaOfferResponse {
  plans: SanaaVoicePlan[];
  founding_offer: SanaaFoundingOffer | null;
  current: {
    status: string;
    authorized: boolean;
    voice_plan_id: string | null;
    campaign_id: string | null;
    experience_expires_at: string | null;
  } | null;
}

export function getSanaaOffer() {
  return ownerFetch<SanaaOfferResponse>('/api/owner/sanaa/offer');
}

export function startSanaaCheckout(params: {
  offer: 'experience' | 'plan';
  plan_id: string;
  campaign_id?: string;
  success_url: string;
  cancel_url: string;
}) {
  return ownerFetch<{ url: string; session_id: string }>('/api/owner/sanaa/checkout', {
    method: 'POST',
    body: params,
  });
}

export function confirmSanaaCheckout(sessionId: string) {
  return ownerFetch<{ status: 'confirmed' | 'pending'; commercial_state: string | null }>(
    '/api/owner/sanaa/checkout/confirm',
    { method: 'POST', body: { session_id: sessionId } },
  );
}
