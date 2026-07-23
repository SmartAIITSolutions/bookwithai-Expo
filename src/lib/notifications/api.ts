import { supabase } from '@/lib/supabase';

const API_BASE = 'https://bookwithai.app';

export interface NotificationItem {
  id: string;
  booking_id: string | null;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

// Wrapped in try/catch so a real network failure resolves to an empty list
// instead of rejecting -- callers do `.then(items => { ...; setLoading(false)
// })` with no .catch, so a rejection here used to leave their loading
// spinner stuck forever with no error shown.
export async function fetchNotifications(): Promise<NotificationItem[]> {
  try {
    const headers = await authHeaders();
    if (!headers) return [];

    const res = await fetch(`${API_BASE}/api/mobile/notifications`, { headers });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers) return;
    await fetch(`${API_BASE}/api/mobile/notifications/${id}`, { method: 'PATCH', headers });
  } catch {
    // Best-effort -- a failed read-receipt isn't worth surfacing an error for.
  }
}

export async function deleteNotification(id: string): Promise<void> {
  try {
    const headers = await authHeaders();
    if (!headers) return;
    await fetch(`${API_BASE}/api/mobile/notifications/${id}`, { method: 'DELETE', headers });
  } catch {
    // Best-effort -- see markNotificationRead.
  }
}
