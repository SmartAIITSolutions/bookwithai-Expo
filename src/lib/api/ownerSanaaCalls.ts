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
  /** Sum of bookings.price_cents for SANAA-created (source='voice_ai'),
   *  non-cancelled bookings in this window -- authoritative service value,
   *  not a transcript-derived estimate. */
  booking_value_cents: number;
  /** appointments_booked / calls_handled * 100, rounded. null when
   *  calls_handled is 0 -- genuinely undefined, never shown as "0%". */
  booking_conversion_percent: number | null;
  /** Real billable minutes used in this window, independent of any
   *  commercial billing cycle -- the only usage figure available for a
   *  prototype tenant with no sanaa_subscriptions row. */
  total_minutes_used_window: number;
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
