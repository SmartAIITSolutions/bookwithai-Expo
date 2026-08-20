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

// `subscribed` is now truthful in production -- the backend derives it from
// the real sanaa_subscriptions commercial state (SANAA commercial-to-setup
// bridge), not a hardcoded false. This function itself is UNCHANGED by that
// bridge: once subscribed=true, its existing telephony-based branches
// (setup_not_started/setup_partial/ready_to_test/ready_to_activate/live)
// already correctly route a freshly-entitled salon into Setup Home. Payment
// success never auto-provisions anything -- the owner still explicitly taps
// through Setup themselves.
//
// Connect isn't genuinely done until the real Telnyx provisioning state
// machine (provisioning_status) reaches 'complete' -- telnyx_agent_id/
// telnyx_number presence alone is not sufficient. A number can be
// purchased (provisioning_status='number_purchased', telnyx_number set)
// while it's still unassigned to the agent's real Telnyx connection; that
// must read as "Connect still in progress," never as ready for Test.
export function deriveSanaaLifecycle(status: SanaaStatus): SanaaLifecycle {
  if (!status.subscribed) return 'non_subscriber';

  // Configure isn't done until the owner explicitly saves & continues --
  // reaching this via telnyx_agent_id presence alone would mean Configure
  // is only ever "complete" once Connect/Provision already ran, which is
  // backwards and skips ever showing Connect as the active step.
  if (!status.config_completed) return 'setup_not_started';

  if (status.provisioning_status !== 'complete') return 'setup_partial';

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
