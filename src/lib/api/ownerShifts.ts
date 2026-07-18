import { ownerFetch } from './ownerApi';

export interface ShiftEntry {
  id: string;
  staff_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clocked_in_via: 'shared_device' | 'individual_account';
  staff: { id: string; name: string } | null;
}

export async function listShifts(opts?: { staffId?: string; openOnly?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.staffId) params.set('staff_id', opts.staffId);
  if (opts?.openOnly) params.set('open', 'true');
  const query = params.toString() ? `?${params.toString()}` : '';
  return ownerFetch<{ data: ShiftEntry[] }>(`/api/owner/staff/shifts${query}`);
}

export async function clockStaff(staffId: string, pin: string, action: 'in' | 'out') {
  return ownerFetch<{ message: string }>('/api/owner/staff/clock', {
    method: 'POST',
    body: { staff_id: staffId, pin, action },
  });
}
