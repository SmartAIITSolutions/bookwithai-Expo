import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';
import { ownerFetch } from '@/lib/api/ownerApi';
import type { UserRole } from '@/lib/auth/AuthContext';

// L10 — server-side persistence for the explicit app-language preference.
// Reuses the exact same booking-app endpoints/columns documented in
// booking-app's supabase/migrations/20260831180000_add_locale_preference_columns.sql:
//   owner + staff  -> GET/POST /api/profile/locale       (profiles.locale)
//   customer       -> GET/POST /api/mobile/profile/locale (customer_profiles.locale)
// This module only ever reads/writes an explicit preference the OWNER of
// the account chose -- never inferred from device locale, phone country
// code, or anything else. AsyncStorage (storage.ts) remains the source of
// truth for signed-out users and for the very first paint of every launch
// (see resolveLocale.ts's priority order, unchanged by this file).

async function customerAuthHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
}

/** Fetches the persisted server preference for the given role, or null if
 *  none was ever explicitly set (or the request fails -- a network error
 *  here must never block app language resolution, which already has a
 *  working local/device fallback). */
export async function fetchServerLanguagePreference(role: UserRole): Promise<string | null> {
  try {
    if (role === 'owner' || role === 'staff') {
      const result = await ownerFetch<{ locale: string | null }>('/api/profile/locale');
      return result.ok ? result.data.locale : null;
    }
    const headers = await customerAuthHeaders();
    if (!headers) return null;
    const res = await fetch(`${API_BASE}/api/mobile/profile/locale`, { headers });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as { locale: string | null } | null;
    return json?.locale ?? null;
  } catch {
    return null;
  }
}

/** Persists an explicit language choice server-side for the given role.
 *  Best-effort/fire-and-forget-safe: callers should not block the local
 *  language switch (already applied via changeLanguage()) on this
 *  resolving -- a failed write only means the preference won't be known
 *  server-side (recipient-locale-aware sends, or another device) until
 *  the next successful call. */
export async function setServerLanguagePreference(role: UserRole, code: string): Promise<void> {
  try {
    if (role === 'owner' || role === 'staff') {
      await ownerFetch('/api/profile/locale', { method: 'POST', body: { locale: code } });
      return;
    }
    const headers = await customerAuthHeaders();
    if (!headers) return;
    await fetch(`${API_BASE}/api/mobile/profile/locale`, {
      method: 'POST', headers, body: JSON.stringify({ locale: code }),
    });
  } catch {
    // Best-effort -- see setLanguagePreference() in storage.ts for the
    // same reasoning: the in-memory/local switch already happened.
  }
}
