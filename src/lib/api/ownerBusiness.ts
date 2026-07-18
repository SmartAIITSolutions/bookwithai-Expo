import { ownerFetch } from './ownerApi';
import { WeekSchedule } from '@/lib/calendar/timeGrid';

export interface Business {
  id: string;
  business_name: string;
  owner_email: string;
  owner_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  iana_timezone: string | null;
  cancellation_policy: string | null;
  week_schedule: WeekSchedule | null;
  morning_brief_hour: number;
  max_daily_bookings: number | null;
  staff_login_mode: 'shared_device' | 'individual_accounts';
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  message: string;
  active: boolean;
}

export async function getBusiness() {
  return ownerFetch<{ business: Business; holidays: Holiday[] }>('/api/owner/business');
}

export async function updateBusiness(patch: Partial<Business>) {
  return ownerFetch('/api/owner/business', { method: 'PATCH', body: patch });
}

export async function addHoliday(holiday: { date: string; name: string; message: string }) {
  return ownerFetch('/api/owner/business/holidays', { method: 'POST', body: holiday });
}

export async function removeHoliday(id: string) {
  return ownerFetch(`/api/owner/business/holidays/${id}`, { method: 'DELETE' });
}
