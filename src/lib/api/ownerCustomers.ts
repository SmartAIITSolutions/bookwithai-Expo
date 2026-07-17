import { ownerFetch } from './ownerApi';
import { OwnerBooking } from './ownerBookings';

export interface CustomerLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  total_bookings?: number | null;
  total_spent_cents?: number | null;
  last_visit?: string | null;
  blocked?: boolean | null;
}

export interface CustomerNote {
  id: string;
  body: string;
  author_name: string | null;
  pinned: boolean;
  created_at: string;
}

// Same shape as OwnerBooking, minus `customer` -- the caller already knows
// which customer this is, so the API doesn't redundantly re-select it.
export type CustomerBookingRow = Omit<OwnerBooking, 'customer'>;

export interface CustomerHealth {
  score: number;
  label: 'Excellent Customer' | 'Doing Well' | 'Needs Attention';
  reasons: string[];
}

export interface CustomerSnapshot {
  lifetime_spend_cents: number;
  visits: number;
  average_ticket_cents: number;
  average_tip_cents: number;
  last_visit: string | null;
  next_visit: string | null;
  years_as_customer: number;
  cancellation_rate: number;
  no_show_rate: number;
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  blocked: boolean | null;
  date_of_birth: string | null;
  created_at: string;
  total_bookings: number | null;
  total_spent_cents: number | null;
  last_visit: string | null;
  preferred_staff_id: string | null;
  preferred_staff: { id: string; name: string } | null;
  opt_out_sms: boolean | null;
  opt_out_email: boolean | null;
}

export interface RewardRow {
  id: string;
  code: string;
  type: string;
  value: number;
  active: boolean;
  uses_count: number;
  max_uses: number;
  expires_at: string | null;
}

export interface CustomerDetailResponse {
  customer: CustomerDetail;
  health: CustomerHealth;
  insights: string[];
  snapshot: CustomerSnapshot;
  upcoming: CustomerBookingRow[];
  past: CustomerBookingRow[];
  notes: CustomerNote[];
  rewards: RewardRow[];
}

export interface TimelineEntry {
  id: string;
  channel: 'email' | 'sms' | 'push' | 'call' | string;
  direction: 'inbound' | 'outbound';
  summary: string;
  at: string;
  meta?: Record<string, unknown>;
}

export interface MediaItem {
  id: string;
  kind: 'photo' | 'document';
  label: string | null;
  storage_path: string;
  uploaded_at: string;
  url: string | null;
}

export async function listCustomers(q: string, page = 0, pageSize = 20) {
  return ownerFetch<{ data: CustomerLite[]; total: number }>(
    `/api/owner/customers?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`
  );
}

export async function searchCustomers(q: string) {
  return ownerFetch<{ data: CustomerLite[] }>(`/api/owner/customers?q=${encodeURIComponent(q)}`);
}

export async function quickCreateCustomer(name: string, phone?: string) {
  return ownerFetch<{ data: CustomerLite }>('/api/owner/customers', { method: 'POST', body: { name, phone } });
}

export async function getCustomer(id: string) {
  return ownerFetch<CustomerDetailResponse>(`/api/owner/customers/${id}`);
}

export async function updateCustomer(id: string, patch: Partial<{
  email: string | null; phone: string | null; date_of_birth: string | null;
  blocked: boolean; preferred_staff_id: string | null; opt_out_sms: boolean; opt_out_email: boolean;
}>) {
  return ownerFetch(`/api/owner/customers/${id}`, { method: 'PATCH', body: patch });
}

export async function deleteCustomer(id: string) {
  return ownerFetch(`/api/owner/customers/${id}`, { method: 'DELETE' });
}

export async function addNote(customerId: string, body: string) {
  return ownerFetch<{ data: CustomerNote }>(`/api/owner/customers/${customerId}/notes`, { method: 'POST', body: { body } });
}

export async function pinNote(customerId: string, noteId: string, pinned: boolean) {
  return ownerFetch(`/api/owner/customers/${customerId}/notes/${noteId}`, { method: 'PATCH', body: { pinned } });
}

export async function deleteNote(customerId: string, noteId: string) {
  return ownerFetch(`/api/owner/customers/${customerId}/notes/${noteId}`, { method: 'DELETE' });
}

export async function getMergeCandidates() {
  return ownerFetch<{ groups: CustomerLite[][] }>('/api/owner/customers/merge-candidates');
}

export async function mergeCustomers(customerIds: string[]) {
  return ownerFetch('/api/owner/customers/merge', { method: 'POST', body: { customer_ids: customerIds } });
}

export async function getCommunications(customerId: string) {
  return ownerFetch<{ data: TimelineEntry[] }>(`/api/owner/customers/${customerId}/communications`);
}

export async function listMedia(customerId: string) {
  return ownerFetch<{ data: MediaItem[] }>(`/api/owner/customers/${customerId}/media`);
}

export async function requestMediaUpload(customerId: string, kind: 'photo' | 'document', fileName: string, label?: string) {
  return ownerFetch<{ data: { id: string; uploadUrl: string; token: string; path: string } }>(
    `/api/owner/customers/${customerId}/media`,
    { method: 'POST', body: { kind, file_name: fileName, label } }
  );
}

export async function deleteMedia(customerId: string, mediaId: string) {
  return ownerFetch(`/api/owner/customers/${customerId}/media/${mediaId}`, { method: 'DELETE' });
}
