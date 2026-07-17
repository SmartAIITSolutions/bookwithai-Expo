import { ownerFetch } from './ownerApi';

export async function getMonthSummary(month: string) {
  return ownerFetch<{ counts: Record<string, number> }>(`/api/owner/bookings/month-summary?month=${month}`);
}
