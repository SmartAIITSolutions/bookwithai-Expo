import { ownerFetch } from './ownerApi';

export type ReportRange = 'today' | 'week' | 'month';

export interface ReportBreakdown {
  name: string;
  count: number;
  revenue_cents: number;
}

export interface OwnerReport {
  range: ReportRange;
  revenue_cents: number;
  appointments: number;
  clients: number;
  top_services: ReportBreakdown[];
  by_staff: ReportBreakdown[];
}

export async function getOwnerReport(range: ReportRange) {
  return ownerFetch<OwnerReport>(`/api/owner/reports?range=${range}`);
}
