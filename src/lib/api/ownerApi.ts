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
): Promise<{ ok: true; data: T } | ({ ok: false; error: string; code?: string } & Record<string, unknown>)> {
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
    // Block Time creation-failure investigation — a response the server
    // never sent as JSON (e.g. a 404 for a route that exists in code but
    // hasn't been deployed to whatever host API_BASE points at, or any
    // other non-JSON error page) used to collapse to a completely
    // undiagnosable "Something went wrong." with no way to tell that apart
    // from a real 500 with a genuine json.error. The HTTP status alone is
    // not sensitive and is exactly what's needed to tell "route missing"
    // apart from "server rejected the request" from the outside.
    // Spreading the raw body after the computed fallbacks lets a route's
    // own extra structured error data (e.g. Block Time's conflicts list)
    // reach the caller without ownerFetch needing to know about every
    // route's own error shape -- error/code above are the guaranteed-
    // present fallbacks; anything else a route sends rides along as-is.
    if (!res.ok) return { ok: false, error: json.error || `Something went wrong. (${res.status})`, code: json.code, ...json };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: 'Unable to connect. Please check your connection and try again.' };
  }
}
