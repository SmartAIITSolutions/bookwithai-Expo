import { ownerFetch } from './ownerApi';

export interface SanaaUsageThresholds {
  // P10: no 50% notification tier by design -- kept out of the type so
  // nothing accidentally builds against it.
  reached_75: boolean;
  reached_90: boolean;
  reached_100: boolean;
  in_overage: boolean;
}

export type SanaaUsage =
  | { available: false; subscription_status: string }
  | {
      available: true;
      subscription_status: string;
      plan_name: string;
      monthly_price_cents: number;
      included_minutes: number;
      used_minutes: number;
      remaining_minutes: number;
      overage_minutes: number;
      overage_rate_cents_per_min: number;
      estimated_overage_cents: number;
      current_period_start: string;
      current_period_end: string;
      usage_percent: number;
      thresholds: SanaaUsageThresholds;
    };

// P9: real usage for the current billing period, computed server-side from
// the actual call ledger (sanaa_call_logs) -- never sanaa_tenants.
// minutes_used_cycle. `available: false` is a real, honest state (no
// subscription/period yet), not an error.
export function getSanaaUsage() {
  return ownerFetch<SanaaUsage>('/api/owner/sanaa/usage');
}
