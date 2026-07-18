import { ownerFetch } from './ownerApi';

export interface TimeOffEntry {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  staff: { id: string; name: string } | null;
}

export async function listTimeOff(status?: 'pending' | 'approved' | 'denied') {
  const query = status ? `?status=${status}` : '';
  return ownerFetch<{ data: TimeOffEntry[] }>(`/api/owner/staff/time-off${query}`);
}

export async function createTimeOff(entry: { staff_id: string; start_date: string; end_date: string; reason?: string }) {
  return ownerFetch('/api/owner/staff/time-off', { method: 'POST', body: entry });
}

export async function decideTimeOff(id: string, status: 'approved' | 'denied') {
  return ownerFetch(`/api/owner/staff/time-off/${id}`, { method: 'PATCH', body: { status } });
}
