import { ownerFetch } from './ownerApi';

export interface MonthSummaryPreview {
  starts_at: string;
  status: string;
  total_charged_cents: number | null;
  checked_in_at: string | null;
  service_started_at: string | null;
  service_completed_at: string | null;
}

export async function getMonthSummary(month: string) {
  return ownerFetch<{ counts: Record<string, number>; previews: Record<string, MonthSummaryPreview[]> }>(`/api/owner/bookings/month-summary?month=${month}`);
}
