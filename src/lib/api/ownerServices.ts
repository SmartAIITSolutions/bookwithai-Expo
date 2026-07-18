import { ownerFetch } from './ownerApi';

export interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  duration_minutes: number;
  price_cents: number;
  buffer_minutes: number;
  display_order: number | null;
  bookable_online: boolean | null;
  gender_restriction: string | null;
  price_is_from: boolean | null;
  active: boolean;
}

export interface AddOnSuggestion {
  service_id: string;
  name: string;
  price_cents: number;
  duration_minutes: number;
  confidence_pct: number;
}

export async function listServices() {
  return ownerFetch<{ data: Service[] }>('/api/owner/services');
}

export async function createService(service: {
  name: string; duration_minutes: number; price_cents: number;
  category?: string; description?: string; bookable_online?: boolean;
}) {
  return ownerFetch('/api/owner/services', { method: 'POST', body: service });
}

export async function updateService(id: string, patch: Partial<Service>) {
  return ownerFetch(`/api/owner/services/${id}`, { method: 'PATCH', body: patch });
}

export async function archiveService(id: string) {
  return ownerFetch(`/api/owner/services/${id}`, { method: 'DELETE' });
}

export async function getAddOnSuggestion(serviceId: string) {
  return ownerFetch<{ suggestion: AddOnSuggestion | null }>(`/api/owner/services/${serviceId}/add-on-suggestion`);
}

// Empty staff_ids means "any staff can perform this service" (no restriction).
export async function getServiceStaff(serviceId: string) {
  return ownerFetch<{ staff_ids: string[]; commission_rates: Record<string, number | null> }>(`/api/owner/services/${serviceId}/staff`);
}

export async function setServiceStaff(serviceId: string, staffIds: string[], commissionRates?: Record<string, number | null>) {
  return ownerFetch(`/api/owner/services/${serviceId}/staff`, { method: 'PUT', body: { staff_ids: staffIds, commission_rates: commissionRates } });
}
