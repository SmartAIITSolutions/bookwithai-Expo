import { supabase } from '@/lib/supabase';

// customer_profiles is person-level and shared across every salon the
// customer books with (distinct from customers, which is per-salon). RLS
// (auth.uid() = auth_user_id) makes a direct client query safe here.
export interface CustomerProfile {
  auth_user_id: string;
  photo_url: string | null;
  date_of_birth: string | null;
  pronouns: string | null;
  timezone: string | null;
}

export async function fetchCustomerProfile(authUserId: string): Promise<CustomerProfile | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('auth_user_id, photo_url, date_of_birth, pronouns, timezone')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  if (error) throw error;
  return data as CustomerProfile | null;
}

export async function upsertCustomerProfile(
  authUserId: string,
  patch: Partial<Pick<CustomerProfile, 'photo_url' | 'date_of_birth' | 'pronouns' | 'timezone'>>
): Promise<void> {
  const { error } = await supabase
    .from('customer_profiles')
    .upsert({ auth_user_id: authUserId, ...patch }, { onConflict: 'auth_user_id' });
  if (error) throw error;
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
