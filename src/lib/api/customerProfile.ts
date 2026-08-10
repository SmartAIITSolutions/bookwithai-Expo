import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';

// customer_profiles is person-level and shared across every salon the
// customer books with (distinct from customers, which is per-salon). RLS
// (auth.uid() = auth_user_id) makes a direct client query safe here.
export interface CustomerProfile {
  auth_user_id: string;
  photo_url: string | null;
  date_of_birth: string | null;
  pronouns: string | null;
  timezone: string | null;
  // Canonical cross-salon identity -- collected once here, reused to
  // auto-fill every new salon's customers row instead of asking again.
  // Mandatory in app logic (enforced via the profile-completeness gate),
  // nullable at the DB level since existing accounts predate this.
  phone: string | null;
  email: string | null;
}

export function isProfileComplete(profile: CustomerProfile | null): boolean {
  return !!profile?.phone?.trim() && !!profile?.email?.trim();
}

export async function fetchCustomerProfile(authUserId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('auth_user_id, photo_url, date_of_birth, pronouns, timezone, phone, email')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as CustomerProfile | null;
}

export async function upsertCustomerProfile(
  authUserId: string,
  patch: Partial<Pick<CustomerProfile, 'photo_url' | 'date_of_birth' | 'pronouns' | 'timezone' | 'phone' | 'email'>>
): Promise<void> {
  const { error } = await supabase
    .from('customer_profiles')
    .upsert({ auth_user_id: authUserId, ...patch }, { onConflict: 'auth_user_id' });
  if (error) throw error;
}

// Retroactively links any pre-existing `customers` row (any salon, any
// creation path -- walk-in, manual web booking, etc.) matching this phone
// or email to this account, and auto-favorites each matched salon. Safe to
// call repeatedly (e.g. every sign-in) -- already-linked rows are a no-op
// server-side. Never throws into the caller's UI flow on failure; this is a
// background reconciliation step, not something that should block sign-in
// or profile saving if the network hiccups.
export async function linkCustomerIdentity(
  phone: string,
  email?: string | null
): Promise<{ linked_count: number; existing_account_detected: boolean }> {
  const fallback = { linked_count: 0, existing_account_detected: false };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return fallback;
  try {
    const res = await fetch(`${API_BASE}/api/mobile/link-customer-identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ phone, email: email ?? undefined }),
    });
    const json = await res.json();
    return {
      linked_count: json.linked_count ?? 0,
      existing_account_detected: !!json.existing_account_detected,
    };
  } catch {
    // best-effort -- retried next sign-in via AuthRedirectGate
    return fallback;
  }
}

export async function uploadProfilePhoto(authUserId: string, uri: string): Promise<string> {
  const fileName = `${Date.now()}.jpg`;
  const path = `${authUserId}/${fileName}`;
  const blob = await (await fetch(uri)).blob();
  const { error } = await supabase.storage.from('profile-photos').upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
  return data.publicUrl;
}
