import AsyncStorage from '@react-native-async-storage/async-storage';
import { ownerFetch } from './ownerApi';

export type SanaaCommercialState =
  | 'none'
  | 'incomplete'
  | 'experience'
  | 'converting'
  | 'active'
  | 'past_due'
  | 'suspended'
  | 'cancel_scheduled'
  | 'cancelled'
  | 'conversion_failed'
  | 'conversion_action_required';

export interface SanaaStatus {
  subscribed: boolean;
  /** Real P4 commercial-to-setup bridge state -- additive, `subscribed` is
   *  still the only field deriveSanaaLifecycle reads. */
  commercial_state?: SanaaCommercialState;
  telnyx_agent_id: string | null;
  telnyx_number: string | null;
  active: boolean;
  test_call_completed: boolean;
  /** Real, server-set signal that the owner explicitly finished Configure
   *  (sanaa_tenants.config_completed_at, set by the "Save & Continue"
   *  action) -- distinct from telnyx_agent_id, which only gets set during
   *  Connect/Provision. */
  config_completed: boolean;
  /** Real Telnyx provisioning state machine (sanaa_tenants.provisioning_status):
   *  'not_started' | 'agent_created' | 'number_purchased' | 'complete'.
   *  Connect isn't genuinely done until this reaches 'complete' -- a
   *  purchased-but-unassigned number ('number_purchased') must not read as
   *  ready for Test. */
  provisioning_status: 'not_started' | 'agent_created' | 'number_purchased' | 'complete';
  /** P11 — desired/authoritative operational state (independent of billing).
   *  'active' | 'paused' | 'suspended'. */
  service_state: 'active' | 'paused' | 'suspended';
  /** P11 — true only once Telnyx has confirmed matching the CURRENT
   *  service_state (never a stale match from a prior state -- the backend
   *  NULLs this on every service_state write). Must gate whether the app
   *  is allowed to present SANAA as truly LIVE. */
  service_synced: boolean;
  /** ISO date the current paid-through period ends, when applicable
   *  (cancel_scheduled, or informational on an active subscription). */
  current_period_end: string | null;
}

export function getSanaaStatus() {
  return ownerFetch<SanaaStatus>('/api/owner/sanaa/status');
}

export interface SanaaServiceActionResult {
  success: boolean;
  service_state: string;
  synced: boolean;
  error?: string;
}

// P11 — voluntary pause. Requires an authorized subscription server-side;
// the salon keeps paying while paused.
export function pauseSanaa() {
  return ownerFetch<SanaaServiceActionResult>('/api/owner/sanaa/pause', { method: 'POST' });
}

// P11 — may only succeed from service_state='paused' AND while commercially
// authorized -- the server refuses (409, code: 'billing_required') if a
// billing suspension is in effect, by design: owner Resume must never
// override it.
export function resumeSanaa() {
  return ownerFetch<SanaaServiceActionResult>('/api/owner/sanaa/resume', { method: 'POST' });
}

// P11 — reconciles Telnyx (assistant/number/webhook/service_state sync) via
// the existing idempotent provisioning routes. Never purchases a number or
// recreates the assistant.
export function repairSanaaConnection() {
  return ownerFetch<{ success: boolean }>('/api/owner/sanaa/repair', { method: 'POST' });
}

// P11 — Stripe's hosted Customer Portal, not a new payment UI.
export function openSanaaBillingPortal(returnUrl?: string) {
  return ownerFetch<{ url: string }>('/api/owner/sanaa/billing-portal', {
    method: 'POST',
    body: returnUrl ? { return_url: returnUrl } : undefined,
  });
}

// P2 owns the real Discovery Home content (demo, FAQ, plans). Until that
// content ships, a production (non-__DEV__) non-subscriber must not see a
// screen full of "coming soon" placeholder sections -- that reads as an
// unfinished product. Flip to true only once P2's real content is ready to
// replace the placeholder surfaces in SanaaDiscoveryHome. __DEV__ builds
// always see the full component regardless, since previewing its layout is
// the point of the dev state-switcher.
export const SANAA_DISCOVERY_LIVE = false;

// The lifecycle states, kept separate from the fetch itself so the
// derivation rule can change later without touching callers.
//
// There is no 'ready_to_activate' state. Product decision (2026-08-22):
// Connect completing (provisioning_status='complete') IS the real technical
// activation boundary -- Telnyx is already answering calls and Book With AI
// is already incurring the infrastructure cost at that point, so a separate
// owner-facing "Activate" step after Test would be artificial and would
// contradict what's actually true. Test verifies the already-active SANAA;
// it doesn't activate her. An earlier pass built a real `activated_at`
// signal/screen for this and it was deliberately removed -- see git history
// (MASTER.md) for that reasoning, kept here only as the "why not" for
// anyone tempted to re-add it.
export type SanaaLifecycle =
  | 'non_subscriber'
  | 'setup_not_started'
  | 'setup_partial'
  | 'ready_to_test'
  | 'live'
  | 'paused'
  | 'action_required';

// `subscribed` is now truthful in production -- the backend derives it from
// the real sanaa_subscriptions commercial state (SANAA commercial-to-setup
// bridge), not a hardcoded false. Payment success never auto-provisions
// anything -- the owner still explicitly taps through Setup themselves.
//
// Connect isn't genuinely done until the real Telnyx provisioning state
// machine (provisioning_status) reaches 'complete' -- telnyx_agent_id/
// telnyx_number presence alone is not sufficient. A number can be
// purchased (provisioning_status='number_purchased', telnyx_number set)
// while it's still unassigned to the agent's real Telnyx connection; that
// must read as "Connect still in progress," never as ready for Test.
//
// `active` (sanaa_tenants.active) is deliberately NOT read here -- it's a
// legacy, pre-P11, display-only field with no telephony dependents, not a
// lifecycle input. Real operational control is service_state (P11).
//
// P11 — a salon that has been through onboarding before and is now
// suspended/cancelled must never fall back to 'non_subscriber' (the same
// screen a business that never paid sees) -- that was the exact bug this
// phase fixes. 'non_subscriber' is reserved for a salon that has never had
// a real commercial_state at all ('none'/'incomplete').
export function deriveSanaaLifecycle(status: SanaaStatus): SanaaLifecycle {
  const commercial = status.commercial_state ?? 'none';
  const neverSubscribed = commercial === 'none' || commercial === 'incomplete';

  if (!status.subscribed && neverSubscribed) return 'non_subscriber';

  if (status.subscribed) {
    // Configure isn't done until the owner explicitly saves & continues --
    // reaching this via telnyx_agent_id presence alone would mean Configure
    // is only ever "complete" once Connect/Provision already ran, which is
    // backwards and skips ever showing Connect as the active step.
    if (!status.config_completed) return 'setup_not_started';
    if (status.provisioning_status !== 'complete') return 'setup_partial';
    if (!status.test_call_completed) return 'ready_to_test';
  }

  // Past onboarding (or with real billing history) but not currently
  // authorized -- past_due grace expired, suspended, cancelled, a failed
  // Experience conversion, etc. Routes to Billing, never to Discovery.
  if (!status.subscribed) return 'action_required';

  // Commercially fine, onboarding complete -- but Telnyx hasn't confirmed
  // matching the desired service_state yet. Never present as truly LIVE
  // until service_synced is true.
  if (!status.service_synced) return 'action_required';

  if (status.service_state === 'paused') return 'paused';

  return 'live';
}

const DEV_STATE_OVERRIDE_KEY = '__sanaa_dev_state_override';
const CARD_DISMISSED_KEY = 'sanaa_card_dismissed';

// Dev-only fixture so every lifecycle screen can be reviewed before real
// subscription/telephony/testing flows exist. __DEV__-gated at every call
// site -- never read or written in a production build.
export async function getDevSanaaStateOverride(): Promise<SanaaLifecycle | null> {
  if (!__DEV__) return null;
  const v = await AsyncStorage.getItem(DEV_STATE_OVERRIDE_KEY);
  return (v as SanaaLifecycle) || null;
}

export async function setDevSanaaStateOverride(state: SanaaLifecycle | null): Promise<void> {
  if (!__DEV__) return;
  if (state) await AsyncStorage.setItem(DEV_STATE_OVERRIDE_KEY, state);
  else await AsyncStorage.removeItem(DEV_STATE_OVERRIDE_KEY);
}

export async function isSanaaCardDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(CARD_DISMISSED_KEY)) === '1';
}

export async function dismissSanaaCard(): Promise<void> {
  await AsyncStorage.setItem(CARD_DISMISSED_KEY, '1');
}
