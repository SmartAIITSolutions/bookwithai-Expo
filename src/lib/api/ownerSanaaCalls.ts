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
  /** Count of sanaa_call_logs rows with outcome='booked' in this window --
   *  a CALL-level annotation, written when the call's own outcome field was
   *  set. Deliberately NOT the same source as booking_value_cents (see
   *  below) -- a real booking can exist without its originating call ever
   *  having outcome='booked' written (confirmed live: Glam Studio's one
   *  voice_ai booking has no call row with outcome='booked' or booking_id
   *  set, investigated 2026-08-25 -- no mutation-ledger or booking_id
   *  linkage exists for that pre-P14B call to safely backfill it). Never
   *  read appointments_booked and booking_value_cents as describing the
   *  same set of calls. */
  appointments_booked: number;
  transfers: number;
  /** Sum of bookings.price_cents for SANAA-created (source='voice_ai'),
   *  non-cancelled bookings in this window -- authoritative service value,
   *  not a transcript-derived estimate. Sourced independently from the
   *  bookings table, NOT from appointments_booked/sanaa_call_logs.outcome
   *  -- a nonzero value here does not imply appointments_booked counted
   *  the same booking. */
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
