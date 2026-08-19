import { ownerFetch } from './ownerApi';

export interface SanaaKnownBusiness {
  business_name: string | null;
  // Effective hours (week_schedule ?? business_hours), keyed by full day
  // name ("Sunday".."Saturday") -- same shape /api/owner/sanaa/config
  // normalizes both source fields into.
  business_hours: Record<string, { open: boolean; start: string; end: string }> | null;
  cancellation_policy: string;
  rescheduling_policy: string;
  service_count: number;
  staff_count: number;
}

export interface SanaaOwnerConfig {
  tone: 'warm_casual' | 'professional_formal' | 'upbeat_energetic';
  transfer_number: string;
  after_hours_booking: boolean;
  notify_owner_bell: boolean;
  notify_owner_email: boolean;
  upsell_enabled: boolean;
}

export interface SanaaConfigResponse {
  business: SanaaKnownBusiness;
  config: SanaaOwnerConfig;
  has_tenant: boolean;
  telnyx_number: string | null;
}

export function getSanaaConfig() {
  return ownerFetch<SanaaConfigResponse>('/api/owner/sanaa/config');
}

// Real financial transaction on the other end (Telnyx number purchase).
// Idempotent server-side -- safe to call again if this returns an error or
// the app doesn't hear back; the backend never buys a second number for the
// same salon.
export function provisionSanaaNumber() {
  return ownerFetch<{ success: boolean; telnyx_number: string; already_provisioned?: boolean }>(
    '/api/owner/sanaa/provision-number',
    { method: 'POST' }
  );
}

export function updateSanaaConfig(patch: Partial<SanaaOwnerConfig>) {
  return ownerFetch<SanaaOwnerConfig>('/api/owner/sanaa/config', { method: 'PATCH', body: patch });
}

export interface SanaaFaq {
  id: string;
  question: string;
  answer: string;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export function listSanaaFaqs() {
  return ownerFetch<{ data: SanaaFaq[] }>('/api/owner/sanaa/faqs');
}

export function createSanaaFaq(faq: { question: string; answer: string; active?: boolean }) {
  return ownerFetch<{ message: string; data: SanaaFaq; warning: string | null }>('/api/owner/sanaa/faqs', {
    method: 'POST',
    body: faq,
  });
}

export function updateSanaaFaq(id: string, patch: { question?: string; answer?: string; active?: boolean }) {
  return ownerFetch<{ message: string; data: SanaaFaq; warning: string | null }>(`/api/owner/sanaa/faqs/${id}`, {
    method: 'PATCH',
    body: patch,
  });
}

export function deleteSanaaFaq(id: string) {
  return ownerFetch<{ message: string }>(`/api/owner/sanaa/faqs/${id}`, { method: 'DELETE' });
}
