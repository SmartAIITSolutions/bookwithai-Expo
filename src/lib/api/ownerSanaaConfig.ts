import { ownerFetch } from './ownerApi';

export interface SanaaKnownBusiness {
  business_name: string | null;
  business_hours: Record<string, { open?: string; close?: string; closed?: boolean }> | null;
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
}

export function getSanaaConfig() {
  return ownerFetch<SanaaConfigResponse>('/api/owner/sanaa/config');
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
