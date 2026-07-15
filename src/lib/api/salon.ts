import { supabase } from '@/lib/supabase';

export interface SalonInfo {
  id: string;
  business_name: string;
  slug: string;
  logo_url?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
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
      'id, business_name, slug, logo_url, phone, address, city, state, zip, iana_timezone, business_hours, cancellation_policy, rescheduling_policy, store_policy, require_online_payment, booking_cutoff_minutes'
    )
    .eq('slug', slug)
    .single();

  if (error || !data) return null;
  return data as SalonInfo;
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
