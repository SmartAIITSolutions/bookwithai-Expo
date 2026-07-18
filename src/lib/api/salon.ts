import { supabase } from '@/lib/supabase';

export interface SalonInfo {
  id: string;
  business_name: string;
  slug: string;
  // TODO: logo_url, address, zip, phone not in agency_clients — add when available (see MASTER.md)
  owner_phone?: string | null;
  city?: string | null;
  state?: string | null;
  iana_timezone?: string | null;
  business_hours?: Record<string, { open: boolean; start: string; end: string }> | null;
  cancellation_policy?: string | null;
  rescheduling_policy?: string | null;
  store_policy?: string | null;
  require_online_payment?: boolean;
  booking_cutoff_minutes?: number;
}

export async function fetchSalonBySlug(slug: string): Promise<SalonInfo | null> {
  const { data, error } = await supabase
    .from('agency_clients')
    .select(
      'id, business_name, slug, owner_phone, city, state, iana_timezone, business_hours, cancellation_policy, rescheduling_policy, store_policy, require_online_payment, booking_cutoff_minutes'
    )
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;
  return data as SalonInfo;
}

export interface StaffMember {
  id: string;
  name: string;
  bio: string | null;
  role: string | null;
}

// serviceIds narrows results to staff assigned to ALL of the given services
// (intersection), via service_staff. A service with zero assignment rows
// means "any staff can perform it", so it doesn't narrow the set.
export async function fetchStaffBySalonId(salonId: string, serviceIds?: string[]): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, bio, role')
    .eq('client_id', salonId)
    .eq('active', true)
    .order('display_order');

  if (error) throw error;
  const allStaff = (data as StaffMember[]) ?? [];
  if (!serviceIds || serviceIds.length === 0) return allStaff;

  const { data: assignments, error: assignError } = await supabase
    .from('service_staff')
    .select('service_id, staff_id')
    .in('service_id', serviceIds);
  if (assignError) throw assignError;

  const byService = new Map<string, Set<string>>();
  for (const row of assignments ?? []) {
    if (!byService.has(row.service_id)) byService.set(row.service_id, new Set());
    byService.get(row.service_id)!.add(row.staff_id);
  }

  // Services with no assignment rows impose no restriction.
  const restrictingSets = serviceIds
    .map((id) => byService.get(id))
    .filter((set): set is Set<string> => !!set && set.size > 0);
  if (restrictingSets.length === 0) return allStaff;

  const intersection = restrictingSets.reduce((acc, set) => new Set([...acc].filter((id) => set.has(id))));
  return allStaff.filter((s) => intersection.has(s.id));
}

export interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  description: string | null;
  category: string | null;
  display_order?: number | null;
  bundle_only?: boolean;
  bookable_online?: boolean | null;
  price_is_from?: boolean | null;
}

export async function fetchServicesBySalonId(salonId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('client_id', salonId)
    .eq('active', true)
    .order('display_order');

  if (error) throw error;
  return (data as Service[]) ?? [];
}

export function formatPrice(priceCents: number, priceIsFrom?: boolean | null): string {
  if (!priceCents) return 'Free';
  const amount = `$${(priceCents / 100).toFixed(0)}`;
  return priceIsFrom ? `${amount} & up` : amount;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function groupServicesByCategory(services: Service[]): { category: string; items: Service[] }[] {
  const map = new Map<string, Service[]>();
  for (const svc of services) {
    const cat = svc.category || 'Services';
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(svc);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

export function formatHours(
  hours: Record<string, { open: boolean; start: string; end: string }> | null | undefined
): { day: string; label: string }[] {
  if (!hours) return [];
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const short: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
  };
  return order.map((day) => {
    const h = hours[day];
    if (!h || !h.open) return { day: short[day], label: 'Closed' };
    return { day: short[day], label: `${formatTime(h.start)} – ${formatTime(h.end)}` };
  });
}

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':');
  const hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:${min} ${ampm}`;
}
