import { ownerFetch } from './ownerApi';

export interface StripeConnectStatus {
  has_account: boolean;
  account_id: string | null;
  details_submitted: boolean | null;
  charges_enabled: boolean | null;
  payouts_enabled: boolean | null;
  onboarding_complete: boolean;
}

export async function getStripeConnectStatus(clientId: string) {
  return ownerFetch<StripeConnectStatus>(`/api/stripe/connect/status?client_id=${encodeURIComponent(clientId)}`);
}

// from=mobile makes the onboarding return_url land on the web app's plain
// static /signup/mobile-done page (no session to resume into) instead of the
// dashboard -- same param the owner-signup wizard already uses.
export async function getStripeConnectUrl(clientId: string) {
  return ownerFetch<{ url: string }>(`/api/stripe/connect?client_id=${encodeURIComponent(clientId)}&from=mobile`);
}

export async function disconnectStripe(clientId: string) {
  return ownerFetch<{ message: string }>('/api/stripe/connect', {
    method: 'DELETE',
    body: { client_id: clientId },
  });
}
