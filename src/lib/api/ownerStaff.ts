import { ownerFetch } from './ownerApi';

export interface DayAvailability {
  day_of_week: number;
  is_working: boolean;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
}

export type PermissionRole = 'manager' | 'receptionist' | 'stylist' | 'assistant';

export interface StaffMember {
  id: string;
  name: string;
  role: string | null;
  active: boolean;
  allow_double_booking: boolean;
  hourly_rate_cents: number | null;
  permission_role: PermissionRole;
  default_commission_rate_pct: number | null;
  has_pin: boolean;
  auth_user_id: string | null;
  invite_email: string | null;
  invite_status: 'invited' | 'active' | null;
  availability: DayAvailability[];
}

export async function listStaff() {
  return ownerFetch<{ data: StaffMember[] }>('/api/owner/staff');
}

export async function createStaff(staff: {
  name: string; role?: string; hourly_rate_cents?: number;
  permission_role?: PermissionRole; default_commission_rate_pct?: number | null;
}) {
  return ownerFetch('/api/owner/staff', { method: 'POST', body: staff });
}

export async function updateStaff(id: string, patch: Partial<StaffMember> & { pin?: string }) {
  return ownerFetch(`/api/owner/staff/${id}`, { method: 'PATCH', body: patch });
}

export async function saveStaffAvailability(id: string, days: DayAvailability[]) {
  return ownerFetch(`/api/owner/staff/${id}/availability`, { method: 'PUT', body: { days } });
}

export async function inviteStaff(id: string, email: string) {
  return ownerFetch(`/api/owner/staff/${id}/invite`, { method: 'POST', body: { email } });
}

export interface CommissionEntry {
  id: string;
  booking_id: string;
  amount_cents: number;
  rate_pct_used: number;
  created_at: string;
}

export async function getStaffCommissions(id: string) {
  return ownerFetch<{ data: CommissionEntry[]; total_cents: number }>(`/api/owner/staff/${id}/commissions`);
}
