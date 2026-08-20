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

export type SanaaProvisioningStatus = 'not_started' | 'agent_created' | 'number_purchased' | 'complete';

export interface SanaaConfigResponse {
  business: SanaaKnownBusiness;
  config: SanaaOwnerConfig;
  has_agent: boolean;
  telnyx_number: string | null;
  // Real provisioning state machine -- a number can be purchased
  // (provisioning_status='number_purchased') before it's actually assigned
  // to the agent's Telnyx connection. Only 'complete' means genuinely done.
  provisioning_status: SanaaProvisioningStatus;
}

export function getSanaaConfig() {
  return ownerFetch<SanaaConfigResponse>('/api/owner/sanaa/config');
}

// Creates the Telnyx AI agent if none exists yet, or refreshes the existing
// one in place (same agent_id) -- idempotent server-side, safe to call every
// time "Get My SANAA Number" is tapped. No phone number is touched here.
export function provisionSanaaAgent() {
  return ownerFetch<{ success: boolean; agent_id: string; tenant_id: string }>(
    '/api/owner/sanaa/provision-agent',
    { method: 'POST' }
  );
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

// The "Save & Continue" action -- marks Configure done with a real,
// server-set timestamp so Setup Home advances to Connect. Idempotent.
export function completeSanaaConfig() {
  return ownerFetch<{ config_completed_at: string }>('/api/owner/sanaa/config/complete', { method: 'POST' });
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
