import { ownerFetch } from './ownerApi';

export interface DashboardHealth {
  score: number;
  label: 'Excellent' | 'Good' | 'Needs Attention';
  reasons: string[];
}

export interface DashboardSnapshot {
  revenue_cents: number;
  revenue_trend_pct: number | null;
  appointments: number;
  clients: number;
  occupancy_pct: number;
}

export interface DashboardData {
  health: DashboardHealth;
  insights: string[];
  snapshot: DashboardSnapshot;
  next_appointment_id: string | null;
}

export async function getDashboard() {
  return ownerFetch<DashboardData>('/api/owner/dashboard');
}
