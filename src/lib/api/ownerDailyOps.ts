import { ownerFetch } from './ownerApi';

export type BusinessStatus = 'open' | 'closed' | 'interrupted';

export async function getBusinessStatus() {
  return ownerFetch<{ business_status: BusinessStatus; business_status_reason: string | null }>('/api/owner/business/status');
}

export async function setBusinessStatus(status: BusinessStatus, reason?: string) {
  return ownerFetch('/api/owner/business/status', { method: 'PATCH', body: { business_status: status, business_status_reason: reason } });
}

export interface BusinessClosure {
  id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
}

export async function listClosures() {
  return ownerFetch<{ data: BusinessClosure[] }>('/api/owner/business/closures');
}

export async function addClosure(starts_on: string, ends_on: string, reason?: string) {
  return ownerFetch('/api/owner/business/closures', { method: 'POST', body: { starts_on, ends_on, reason } });
}

export async function removeClosure(id: string) {
  return ownerFetch(`/api/owner/business/closures/${id}`, { method: 'DELETE' });
}

export interface StaffScheduleOverride {
  id: string;
  date: string;
  is_working: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export async function getStaffOverride(staffId: string, date: string) {
  return ownerFetch<{ data: StaffScheduleOverride[] }>(`/api/owner/staff/${staffId}/schedule-override?date=${date}`);
}

export async function setStaffOverride(staffId: string, override: { date: string; is_working: boolean; reason?: string }) {
  return ownerFetch(`/api/owner/staff/${staffId}/schedule-override`, { method: 'POST', body: override });
}

export interface Announcement {
  id: string;
  message: string;
  created_at: string;
}

export async function listAnnouncements() {
  return ownerFetch<{ data: Announcement[] }>('/api/owner/announcements');
}

export async function postAnnouncement(message: string) {
  return ownerFetch('/api/owner/announcements', { method: 'POST', body: { message } });
}

export async function dismissAnnouncement(id: string) {
  return ownerFetch(`/api/owner/announcements/${id}`, { method: 'DELETE' });
}

export interface ChecklistState {
  items: string[];
  completed_items: string[];
  completed_at: string | null;
}

export async function getChecklist(type: 'opening' | 'closing', date: string) {
  return ownerFetch<ChecklistState>(`/api/owner/checklists?type=${type}&date=${date}`);
}

export async function saveChecklist(type: 'opening' | 'closing', date: string, completedItems: string[]) {
  return ownerFetch('/api/owner/checklists', { method: 'PATCH', body: { type, date, completed_items: completedItems } });
}
