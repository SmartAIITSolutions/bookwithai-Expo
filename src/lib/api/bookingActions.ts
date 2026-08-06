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

export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ ok: boolean; error?: string; deposit_refund_outcome?: 'refunded' | 'forfeited' | null }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Not signed in.' };

  const res = await fetch(`${API_BASE}/api/mobile/bookings/${bookingId}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Could not cancel booking.' };
  return { ok: true, deposit_refund_outcome: json.deposit_refund_outcome ?? null };
}

export async function checkInBooking(bookingId: string): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Not signed in.' };

  const res = await fetch(`${API_BASE}/api/mobile/bookings/${bookingId}/check-in`, {
    method: 'POST',
    headers,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Could not check in.' };
  return { ok: true };
}

export async function rescheduleBooking(
  bookingId: string,
  startsAt: string,
  endsAt: string
): Promise<{ ok: boolean; error?: string }> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, error: 'Not signed in.' };

  const res = await fetch(`${API_BASE}/api/mobile/bookings/${bookingId}/reschedule`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ starts_at: startsAt, ends_at: endsAt }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Could not reschedule booking.' };
  return { ok: true };
}
