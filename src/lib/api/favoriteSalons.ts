import { supabase } from '@/lib/supabase';

// customer_favorite_salons is keyed by auth_user_id (not customer_id), since
// a salon can be favorited before the customer ever books there -- same
// person-level pattern as customer_profiles. RLS (auth.uid() = auth_user_id)
// makes a direct client query safe here.
export interface FavoriteSalon {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
}

export async function fetchFavoriteSalons(): Promise<FavoriteSalon[]> {
  const { data: favorites, error } = await supabase
    .from('customer_favorite_salons')
    .select('client_id, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!favorites || favorites.length === 0) return [];

  const clientIds = favorites.map((f) => f.client_id);
  const { data: salons, error: salonsError } = await supabase
    .from('agency_clients')
    .select('id, business_name, slug, brand_studio_settings ( logo_url )')
    .in('id', clientIds);
  if (salonsError) throw salonsError;

  const byId = new Map((salons ?? []).map((s: any) => [s.id, s]));
  return clientIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((s: any) => ({
      id: s.id,
      business_name: s.business_name,
      slug: s.slug,
      logo_url: s.brand_studio_settings?.logo_url ?? null,
    }));
}

export async function fetchFavoriteSalonIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('customer_favorite_salons')
    .select('client_id');
  if (error) throw error;
  return new Set((data ?? []).map((f) => f.client_id));
}

export async function addFavoriteSalon(clientId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  const { error } = await supabase
    .from('customer_favorite_salons')
    .upsert({ auth_user_id: user.id, client_id: clientId }, { onConflict: 'auth_user_id,client_id' });
  if (error) throw error;
}

export async function removeFavoriteSalon(clientId: string): Promise<void> {
  const { error } = await supabase
    .from('customer_favorite_salons')
    .delete()
    .eq('client_id', clientId);
  if (error) throw error;
}
