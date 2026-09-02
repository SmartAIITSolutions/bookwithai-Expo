import { supabase } from '@/lib/supabase';
import i18n from '@/lib/i18n';
import { formatWeekdayShort, formatTimeShort, formatCentsUSDWhole } from '@/lib/i18n/format';

export interface SalonInfo {
  id: string;
  business_name: string;
  slug: string;
  owner_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  logo_url?: string | null;
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
      'id, business_name, slug, owner_phone, address_line1, address_line2, city, state, postal_code, iana_timezone, business_hours, cancellation_policy, rescheduling_policy, store_policy, require_online_payment, booking_cutoff_minutes, brand_studio_settings ( logo_url )'
    )
    .eq('slug', slug)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  if (!data) return null;

  const { brand_studio_settings, ...rest } = data as any;
  return { ...rest, logo_url: brand_studio_settings?.logo_url ?? null } as SalonInfo;
}

export interface SalonListing {
  id: string;
  business_name: string;
  slug: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Directory for the customer app's "Discover" tab. Only salons that opted in
// via publicly_listed are browsable; test salons are always excluded.
export async function fetchSalonDirectory(query?: string): Promise<SalonListing[]> {
  let q = supabase
    .from('agency_clients')
    .select('id, business_name, slug, city, state, latitude, longitude, brand_studio_settings ( logo_url )')
    .eq('publicly_listed', true)
    .eq('is_test', false)
    .order('business_name');

  const trimmed = query?.trim();
  if (trimmed) {
    q = q.or(`business_name.ilike.%${trimmed}%,city.ilike.%${trimmed}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return ((data as any[]) ?? []).map(({ brand_studio_settings, ...rest }) => ({
    ...rest,
    logo_url: brand_studio_settings?.logo_url ?? null,
  }));
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
  if (!priceCents) return i18n.t('booking:price.free');
  const amount = formatCentsUSDWhole(priceCents);
  return priceIsFrom ? i18n.t('booking:price.andUp', { amount }) : amount;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return i18n.t('booking:duration.minAbbrev', { count: minutes });
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m
    ? i18n.t('booking:duration.hoursMinutes', { hours: h, minutes: m })
    : i18n.t('booking:duration.hoursOnly', { hours: h });
}

export function groupServicesByCategory(services: Service[]): { category: string; items: Service[] }[] {
  const map = new Map<string, Service[]>();
  for (const svc of services) {
    const cat = svc.category || i18n.t('booking:servicesDefaultCategory');
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(svc);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}

// 2024-01-01 was a real Monday -- used only as a stable reference date so
// Intl.DateTimeFormat can produce a locale-correct weekday name for a given
// day-of-week index. The actual calendar date is never displayed or used.
const REFERENCE_MONDAY = new Date(2024, 0, 1);

export function formatHours(
  hours: Record<string, { open: boolean; start: string; end: string }> | null | undefined
): { day: string; label: string; closed: boolean }[] {
  if (!hours) return [];
  const order = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return order.map((day, index) => {
    const weekdayDate = new Date(REFERENCE_MONDAY);
    weekdayDate.setDate(REFERENCE_MONDAY.getDate() + index);
    const dayLabel = formatWeekdayShort(weekdayDate);
    const h = hours[day];
    if (!h || !h.open) return { day: dayLabel, label: i18n.t('booking:salonDetail.closed'), closed: true };
    return { day: dayLabel, label: `${formatTime(h.start)} – ${formatTime(h.end)}`, closed: false };
  });
}

function formatTime(t: string): string {
  const [hourStr, min] = t.split(':');
  const hour = parseInt(hourStr, 10);
  const d = new Date(2024, 0, 1, hour, parseInt(min, 10));
  return formatTimeShort(d);
}
