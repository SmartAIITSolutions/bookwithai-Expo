import { ownerFetch } from './ownerApi';

export interface DayAvailability {
  day_of_week: number;
  is_working: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
  allow_double_booking: boolean;
  hourly_rate_cents: number | null;
  availability: DayAvailability[];
}

export async function listStaff() {
  return ownerFetch<{ data: StaffMember[] }>('/api/owner/staff');
}

export async function createStaff(staff: { name: string; role?: string; hourly_rate_cents?: number }) {
  return ownerFetch('/api/owner/staff', { method: 'POST', body: staff });
}

export async function updateStaff(id: string, patch: Partial<StaffMember>) {
  return ownerFetch(`/api/owner/staff/${id}`, { method: 'PATCH', body: patch });
}

export async function saveStaffAvailability(id: string, days: DayAvailability[]) {
  return ownerFetch(`/api/owner/staff/${id}/availability`, { method: 'PUT', body: { days } });
}
