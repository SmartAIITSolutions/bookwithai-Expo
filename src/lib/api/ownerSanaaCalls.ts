import { ownerFetch } from './ownerApi';

export interface SanaaCall {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  from_number: string | null;
  to_number: string | null;
  status: string | null;
  outcome: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
  transferred_at: string | null;
  booking_id: string | null;
  summary: string | null;
  transcript_text: string | null;
  has_recording: boolean;
}

export interface SanaaCallsResponse {
  calls: SanaaCall[];
  hasMore: boolean;
}

export interface SanaaCallsSummary {
  window_days: number;
  calls_handled: number;
  appointments_booked: number;
  transfers: number;
}

// P8: paginated real call history for the owner's own SANAA tenant.
// client_id is always derived server-side from the authenticated caller.
export function getSanaaCalls(page = 0) {
  return ownerFetch<SanaaCallsResponse>(`/api/owner/sanaa/calls?page=${page}`);
}

// P8.4: Operations Home's 3 Results metrics (last 30 days, server-aggregated).
export function getSanaaCallsSummary() {
  return ownerFetch<SanaaCallsSummary>('/api/owner/sanaa/calls?summary=1');
}
