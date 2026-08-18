import AsyncStorage from '@react-native-async-storage/async-storage';
import { ownerFetch } from './ownerApi';

export interface SanaaStatus {
  subscribed: boolean;
  telnyx_agent_id: string | null;
  telnyx_number: string | null;
  active: boolean;
  test_call_completed: boolean;
}

export function getSanaaStatus() {
  return ownerFetch<SanaaStatus>('/api/owner/sanaa/status');
}

// P2 owns the real Discovery Home content (demo, FAQ, plans). Until that
// content ships, a production (non-__DEV__) non-subscriber must not see a
// screen full of "coming soon" placeholder sections -- that reads as an
// unfinished product. Flip to true only once P2's real content is ready to
// replace the placeholder surfaces in SanaaDiscoveryHome. __DEV__ builds
// always see the full component regardless, since previewing its layout is
// the point of the dev state-switcher.
export const SANAA_DISCOVERY_LIVE = false;

// The 8 P0/P1 lifecycle states from the SANAA spec. Kept separate from the
// fetch itself so the derivation rule can change later (e.g. once billing/
// telephony/config status genuinely diverge) without touching callers.
export type SanaaLifecycle =
  | 'non_subscriber'
  | 'setup_not_started'
  | 'setup_partial'
  | 'ready_to_test'
  | 'ready_to_activate'
  | 'live'
  | 'paused'
  | 'action_required';

// IMPORTANT — what this function can honestly claim today:
//
// The backend (`GET /api/owner/sanaa/status`) always reports
// `subscribed: false` until P4 introduces a real subscription/billing
// source (see that route's comments) -- so in production this function
// only ever returns 'non_subscriber'. That is intentional, not an
// oversight: the other 7 states are NOT genuinely derivable from what the
// current fields can tell us. In particular `action_required` will
// eventually need to distinguish payment failure, phone disconnection,
// provisioning error, invalid config, suspended subscription, a removed
// number, and an unhealthy Telnyx agent -- none of which today's fields
// (telnyx_agent_id/telnyx_number/active) can tell apart. The branches below
// exist only so the `__DEV__` state-override switcher has real logic to
// preview against once those fields genuinely exist -- they are not live
// production logic yet. Do not treat this as a finished state machine;
// extend the backend fields first, then this function, together.
export function deriveSanaaLifecycle(status: SanaaStatus): SanaaLifecycle {
  if (!status.subscribed) return 'non_subscriber';

  // Provisioned but the agent was never fully wired up (e.g. Telnyx
  // agent creation failed) -- surfaced as needing attention rather than
  // silently sitting in an ambiguous setup state.
  if (status.telnyx_agent_id && !status.telnyx_number) return 'action_required';

  if (!status.telnyx_agent_id) return 'setup_not_started';
  if (!status.telnyx_number) return 'setup_partial';
  if (!status.test_call_completed) return 'ready_to_test';
  if (!status.active) return status.test_call_completed ? 'ready_to_activate' : 'setup_partial';

  return 'live';
  // 'paused' is reachable once an explicit pause action exists (a later
  // phase) -- P0/P1 has no distinct pause signal from 'active: false' yet,
  // since that also covers "never activated."
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
