// No real analytics backend exists in this app yet (confirmed by repo-wide
// search before writing this). This stub exists purely to centralize SANAA
// Discovery call sites in one place -- SANAA-P2-SPEC §38, trimmed per
// correction #9 to only the events that are actually meaningful without a
// backend to send them to. No section-by-section visibility tracking.
export type SanaaAnalyticsEvent =
  | 'discovery_opened'
  | 'demo_scenario_selected'
  | 'demo_started'
  | 'demo_completed'
  | 'demo_failed'
  | 'faq_expanded'
  | 'see_plans_tapped';

export function trackSanaaEvent(name: SanaaAnalyticsEvent, props?: Record<string, unknown>): void {
  if (__DEV__) {
    console.log(`[sanaa-analytics] ${name}`, props ?? {});
  }
  // No-op in production until a real analytics backend exists -- wiring one
  // in later only requires changing this function, not any call site.
}
