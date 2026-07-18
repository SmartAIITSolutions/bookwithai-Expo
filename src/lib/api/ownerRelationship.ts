import { ownerFetch } from './ownerApi';

export interface TimelineEvent {
  type: 'joined' | 'first_visit' | 'visit_milestone' | 'reward' | 'membership' | 'package' | 'referral' | 'priority';
  label: string;
  at: string;
}

export async function getRelationshipTimeline(customerId: string) {
  return ownerFetch<{ data: TimelineEvent[] }>(`/api/owner/customers/${customerId}/relationship-timeline`);
}

export interface ReferralInfo {
  id: string;
  reward_status: 'none' | 'pending' | 'granted';
  created_at: string;
}

export interface ReferredByInfo extends ReferralInfo {
  referrer: { id: string; name: string } | null;
}

export interface ReferredInfo extends ReferralInfo {
  referred: { id: string; name: string } | null;
}

export async function getReferrals(customerId: string) {
  return ownerFetch<{ referred_by: ReferredByInfo | null; referred: ReferredInfo[] }>(`/api/owner/customers/${customerId}/referrals`);
}

export async function setReferredBy(customerId: string, referrerCustomerId: string | null) {
  return ownerFetch(`/api/owner/customers/${customerId}/referrals`, { method: 'PATCH', body: { referrer_customer_id: referrerCustomerId } });
}

export async function grantReferralReward(customerId: string, referralId: string, type: 'percent' | 'fixed', value: number) {
  return ownerFetch(`/api/owner/customers/${customerId}/referrals/${referralId}/grant-reward`, { method: 'POST', body: { type, value } });
}
