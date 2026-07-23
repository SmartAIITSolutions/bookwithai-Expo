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

async function staffFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  // Wrapped so this always resolves to { ok } rather than rejecting on a
  // real network failure -- see the identical comment in ownerApi.ts for why.
  try {
    const headers = await authHeaders();
    if (!headers) return { ok: false, error: 'Not signed in.' };

    const res = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || 'Something went wrong.' };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}

export async function linkStaffInvite() {
  return staffFetch<{ staffId: string; staffName: string; permissionRole: string }>('/api/mobile/link-staff-invite', { method: 'POST' });
}

export interface StaffAppointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price_cents: number | null;
  staff: { id: string; name: string } | null;
  services: { id: string; name: string } | null;
  customer: { id: string; name: string } | null;
}

export async function fetchStaffAppointments() {
  return staffFetch<{ data: StaffAppointment[]; scope: 'own' | 'all' }>('/api/mobile/staff/appointments');
}

export async function staffClock(action: 'in' | 'out') {
  return staffFetch<{ message: string }>('/api/mobile/staff/clock', { method: 'POST', body: { action } });
}

export interface StaffShift {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clocked_in_via: string;
}

export async function fetchStaffShifts() {
  return staffFetch<{ data: StaffShift[] }>('/api/mobile/staff/shifts');
}

export interface StaffTimeOffEntry {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
}

export async function fetchStaffTimeOff() {
  return staffFetch<{ data: StaffTimeOffEntry[] }>('/api/mobile/staff/time-off');
}

export async function requestStaffTimeOff(entry: { start_date: string; end_date: string; reason?: string }) {
  return staffFetch('/api/mobile/staff/time-off', { method: 'POST', body: entry });
}

export interface StaffCommissionEntry {
  id: string;
  booking_id: string;
  amount_cents: number;
  rate_pct_used: number;
  created_at: string;
}

export async function fetchStaffCommissions() {
  return staffFetch<{ data: StaffCommissionEntry[]; total_cents: number }>('/api/mobile/staff/commissions');
}
