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

// Thin wrapper around every /api/owner/* call — one place to change auth
// handling or error shape as future sprints add more endpoints.
export async function ownerFetch<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  // The whole body is wrapped in try/catch so this function always resolves
  // to the documented { ok: true | false } shape, never rejects -- callers
  // across the app assume that contract (e.g. `getX().then(r => { ...;
  // setLoading(false); })` with no .catch), and a real network failure
  // throwing instead of resolving used to leave those screens' loading
  // spinners stuck forever with no error shown.
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
