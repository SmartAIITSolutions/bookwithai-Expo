import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface RewardPromo {
  id: string;
  code: string;
  type: string;
  value: number;
  expires_at: string | null;
}

export type CustomerSummary =
  | { is_new_customer: true }
  | {
      is_new_customer: false;
      total_spent_cents: number;
      total_bookings: number;
      last_visit: string | null;
      birthday_this_week: boolean;
      available_rewards: RewardPromo[];
    };

export async function fetchCustomerSummary(clientId: string): Promise<CustomerSummary | null> {
  const headers = await authHeaders();
  if (!headers) return null;

  const res = await fetch(`${API_BASE}/api/mobile/customer-summary?client_id=${clientId}`, { headers });
  if (!res.ok) return null;
  return res.json();
}

export async function saveCustomerPreferences(
  clientId: string,
  prefs: { preferred_staff_id?: string | null; preferred_service_id?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Not signed in.' };

  const res = await fetch(`${API_BASE}/api/mobile/customer-preferences`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ client_id: clientId, ...prefs }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Could not save preferences.' };
  return { ok: true };
}

export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Not signed in.' };

  const res = await fetch(`${API_BASE}/api/mobile/account`, { method: 'DELETE', headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Could not delete account.' };
  return { ok: true };
}

export async function fetchMembershipStatus(): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;

  const res = await fetch(`${API_BASE}/api/mobile/membership-status`, { headers });
  if (!res.ok) return false;
  const json = await res.json();
  return json.has_active_membership === true;
}

export async function submitBookingReview(
  bookingId: string,
  stars: number,
  reviewText?: string
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Not signed in.' };

  const res = await fetch(`${API_BASE}/api/mobile/bookings/${bookingId}/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ stars, review_text: reviewText }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Could not submit review.' };
  return { ok: true };
}
