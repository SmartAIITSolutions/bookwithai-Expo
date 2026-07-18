import { ownerFetch } from './ownerApi';

export type BillingInterval = 'monthly' | 'yearly';
export type BillingMode = 'manual' | 'stripe_subscription';
export type MembershipStatus = 'active' | 'past_due' | 'cancelled' | 'expired';

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_interval: BillingInterval;
  billing_mode: BillingMode;
  discount_pct: number | null;
  included_visits_per_cycle: number | null;
  stripe_price_id: string | null;
  active: boolean;
}

export async function listMembershipPlans() {
  return ownerFetch<{ data: MembershipPlan[] }>('/api/owner/membership-plans');
}

export async function createMembershipPlan(plan: {
  name: string; description?: string; price_cents: number;
  billing_interval: BillingInterval; billing_mode: BillingMode;
  discount_pct?: number | null; included_visits_per_cycle?: number | null;
}) {
  return ownerFetch('/api/owner/membership-plans', { method: 'POST', body: plan });
}

export async function updateMembershipPlan(id: string, patch: Partial<Pick<MembershipPlan, 'name' | 'description' | 'discount_pct' | 'included_visits_per_cycle' | 'active'>>) {
  return ownerFetch(`/api/owner/membership-plans/${id}`, { method: 'PATCH', body: patch });
}

export interface CustomerMembership {
  id: string;
  plan_id: string;
  status: MembershipStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  visits_used_this_cycle: number;
  membership_plans: { name: string; billing_mode: BillingMode; billing_interval: BillingInterval; discount_pct: number | null; included_visits_per_cycle: number | null } | null;
}

export async function listCustomerMemberships(customerId: string) {
  return ownerFetch<{ data: CustomerMembership[] }>(`/api/owner/customers/${customerId}/memberships`);
}

export async function purchaseMembership(customerId: string, planId: string) {
  return ownerFetch<{ checkout_url?: string; activated: boolean }>(`/api/owner/customers/${customerId}/memberships`, {
    method: 'POST', body: { plan_id: planId },
  });
}

export async function renewMembership(customerId: string, membershipId: string) {
  return ownerFetch(`/api/owner/customers/${customerId}/memberships/${membershipId}/renew`, { method: 'POST' });
}

export async function cancelMembership(customerId: string, membershipId: string) {
  return ownerFetch(`/api/owner/customers/${customerId}/memberships/${membershipId}/cancel`, { method: 'POST' });
}
