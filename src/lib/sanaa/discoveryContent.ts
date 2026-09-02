// Structured local content for SANAA Discovery Home (P2). Deliberately plain
// data, not a CMS -- SANAA-P2-SPEC §41. Keep new copy here, not scattered
// across component files, so it's easy to review/edit without touching JSX.
//
// L6 migration: every export became a get*() function reading through the
// standalone i18n instance (same pattern as appointmentVisual.ts's
// paymentLabel()) instead of a plain constant, so the copy re-renders in
// the active app language. Callers must call the function, not import a
// frozen array.
import i18n from '@/lib/i18n';

export type SanaaDemoScenarioId =
  | 'booking' | 'reschedule' | 'cancel' | 'question' | 'transfer' | 'after_hours';

// 'simulation' = a real, scripted, locally-fixtured UI sequence we own today
// (only 'booking' has one -- SANAA-P2-SPEC correction #5). 'media' = a real
// recorded demo, none of which exist yet (mediaAsset stays undefined until
// one is approved and we know the playback format -- correction #1).
export interface SanaaDemoScenario {
  id: SanaaDemoScenarioId;
  title: string;
  description: string;
  kind: 'simulation' | 'media';
  mediaAsset?: never; // no playback dependency chosen yet; shape reserved for later
  outcomeLabel?: string;
}

export function getSanaaDemoScenarios(): SanaaDemoScenario[] {
  const t = i18n.t;
  return [
    {
      id: 'booking',
      title: t('sanaa:demoScenarios.bookingTitle'),
      description: t('sanaa:demoScenarios.bookingDescription'),
      kind: 'simulation',
      outcomeLabel: t('sanaa:demoScenarios.bookingOutcome'),
    },
    {
      id: 'reschedule',
      title: t('sanaa:demoScenarios.rescheduleTitle'),
      description: t('sanaa:demoScenarios.rescheduleDescription'),
      kind: 'media',
    },
    {
      id: 'cancel',
      title: t('sanaa:demoScenarios.cancelTitle'),
      description: t('sanaa:demoScenarios.cancelDescription'),
      kind: 'media',
    },
    {
      id: 'question',
      title: t('sanaa:demoScenarios.questionTitle'),
      description: t('sanaa:demoScenarios.questionDescription'),
      kind: 'media',
    },
    {
      id: 'transfer',
      title: t('sanaa:demoScenarios.transferTitle'),
      description: t('sanaa:demoScenarios.transferDescription'),
      kind: 'media',
    },
    {
      id: 'after_hours',
      title: t('sanaa:demoScenarios.afterHoursTitle'),
      description: t('sanaa:demoScenarios.afterHoursDescription'),
      kind: 'media',
    },
  ];
}

export interface SanaaCapability {
  icon: string; // Ionicons glyph name, kept as string to avoid importing Ionicons types here
  label: string;
}

// Exactly the 6 categories locked in SANAA-P2-SPEC §17 -- do not expand into
// a feature inventory; detailed subclaims are P3's decision.
export function getSanaaCapabilities(): SanaaCapability[] {
  const t = i18n.t;
  return [
    { icon: 'call-outline', label: t('sanaa:capabilities.answersCalls') },
    { icon: 'calendar-outline', label: t('sanaa:capabilities.booksAppointments') },
    { icon: 'swap-horizontal-outline', label: t('sanaa:capabilities.reschedulesCancels') },
    { icon: 'help-circle-outline', label: t('sanaa:capabilities.answersQuestions') },
    { icon: 'person-outline', label: t('sanaa:capabilities.transfersWhenNeeded') },
    { icon: 'moon-outline', label: t('sanaa:capabilities.worksAfterHours') },
  ];
}

export interface SanaaHowItWorksStep {
  step: number;
  label: string;
}

// SANAA-P2-SPEC §20 -- call mechanics only, zero technical/architecture
// terms anywhere in this copy (§21 is a hard rule).
export function getSanaaHowItWorksSteps(): SanaaHowItWorksStep[] {
  const t = i18n.t;
  return [
    { step: 1, label: t('sanaa:howItWorks.step1') },
    { step: 2, label: t('sanaa:howItWorks.step2') },
    { step: 3, label: t('sanaa:howItWorks.step3') },
    { step: 4, label: t('sanaa:howItWorks.step4') },
  ];
}

export interface SanaaComparisonRow {
  dimension: string;
  human: string;
  sanaa: string;
}

// Qualitative only -- no dollar figures (none are verified/approved). This
// entire section stays __DEV__-only regardless of SANAA_DISCOVERY_LIVE; see
// SANAA_COMPARISON_APPROVED below.
export function getSanaaComparisonRows(): SanaaComparisonRow[] {
  const t = i18n.t;
  return [
    { dimension: t('sanaa:comparison.availabilityDimension'), human: t('sanaa:comparison.availabilityHuman'), sanaa: t('sanaa:comparison.availabilitySanaa') },
    { dimension: t('sanaa:comparison.missedCallsDimension'), human: t('sanaa:comparison.missedCallsHuman'), sanaa: t('sanaa:comparison.missedCallsSanaa') },
    { dimension: t('sanaa:comparison.coverageDimension'), human: t('sanaa:comparison.coverageHuman'), sanaa: t('sanaa:comparison.coverageSanaa') },
    { dimension: t('sanaa:comparison.consistencyDimension'), human: t('sanaa:comparison.consistencyHuman'), sanaa: t('sanaa:comparison.consistencySanaa') },
  ];
}

// Comparison claims (even qualitative ones like "always picks up") need
// their own explicit approval separate from the rest of Discovery, since
// they can become inaccurate depending on uptime/plan limits/phone state.
// Flip only when that copy is specifically signed off -- not the same
// moment SANAA_DISCOVERY_LIVE flips.
export const SANAA_COMPARISON_APPROVED = false;

export interface SanaaTestimonial {
  quote: string;
  attribution: string;
}

// Empty until genuine, verifiable social proof exists -- SANAA-P2-SPEC §24.
// SanaaSocialProof renders nothing at all when this is empty. Never fill
// this with sample/generated content for a production build.
export const SANAA_TESTIMONIALS: SanaaTestimonial[] = [];

export type SanaaFaqStatus = 'approved' | 'pending';

export interface SanaaFaqItem {
  question: string;
  answer?: string; // omitted for 'pending' items -- nothing to leak in production
  status: SanaaFaqStatus;
}

export interface SanaaFaqGroup {
  title: string;
  items: SanaaFaqItem[];
}

// SANAA-P2-SPEC §25-27. 'approved' items are answerable from decisions
// already locked in the P0/P1/P2 specs themselves -- nothing here invents
// a P3/P4 business rule. Everything touching a not-yet-locked decision is
// 'pending': hidden in production, shown with a dev-only marker so it's
// never mistaken for approved copy.
export function getSanaaFaqGroups(): SanaaFaqGroup[] {
  const t = i18n.t;
  return [
    {
      title: t('sanaa:faq.gettingStartedTitle'),
      items: [
        { status: 'approved', question: t('sanaa:faq.whatIsSanaaQ'), answer: t('sanaa:faq.whatIsSanaaA') },
        { status: 'approved', question: t('sanaa:faq.whatCanSanaaDoQ'), answer: t('sanaa:faq.whatCanSanaaDoA') },
        { status: 'approved', question: t('sanaa:faq.isSanaaRealPersonQ'), answer: t('sanaa:faq.isSanaaRealPersonA') },
        { status: 'pending', question: t('sanaa:faq.howDifficultSetupQ') },
        { status: 'approved', question: t('sanaa:faq.canBookWithAiSetUpQ'), answer: t('sanaa:faq.canBookWithAiSetUpA') },
      ],
    },
    {
      title: t('sanaa:faq.callsPhoneTitle'),
      items: [
        { status: 'pending', question: t('sanaa:faq.currentNumberQ') },
        { status: 'pending', question: t('sanaa:faq.needAnotherNumberQ') },
        { status: 'approved', question: t('sanaa:faq.transferCallsQ'), answer: t('sanaa:faq.transferCallsA') },
        { status: 'approved', question: t('sanaa:faq.canPauseQ'), answer: t('sanaa:faq.canPauseA') },
        { status: 'approved', question: t('sanaa:faq.afterHoursQ'), answer: t('sanaa:faq.afterHoursA') },
      ],
    },
    {
      title: t('sanaa:faq.appointmentsTitle'),
      items: [
        { status: 'approved', question: t('sanaa:faq.bookAppointmentsQ'), answer: t('sanaa:faq.bookAppointmentsA') },
        { status: 'approved', question: t('sanaa:faq.rescheduleAppointmentsQ'), answer: t('sanaa:faq.yesA') },
        { status: 'approved', question: t('sanaa:faq.cancelAppointmentsQ'), answer: t('sanaa:faq.yesA') },
        { status: 'approved', question: t('sanaa:faq.knowAvailabilityQ'), answer: t('sanaa:faq.knowAvailabilityA') },
      ],
    },
    {
      title: t('sanaa:faq.customersTitle'),
      items: [
        { status: 'approved', question: t('sanaa:faq.knowIsAiQ'), answer: t('sanaa:faq.knowIsAiA') },
        { status: 'pending', question: t('sanaa:faq.dontKnowAnswerQ') },
        { status: 'pending', question: t('sanaa:faq.controlWhatSaysQ') },
        { status: 'pending', question: t('sanaa:faq.languagesSupportQ') },
      ],
    },
    {
      title: t('sanaa:faq.plansBillingTitle'),
      items: [
        { status: 'pending', question: t('sanaa:faq.pricingWorkQ') },
        { status: 'pending', question: t('sanaa:faq.activationFeeQ') },
        { status: 'pending', question: t('sanaa:faq.changePlansQ') },
        { status: 'pending', question: t('sanaa:faq.canCancelQ') },
        { status: 'pending', question: t('sanaa:faq.paymentFailsQ') },
      ],
    },
    {
      title: t('sanaa:faq.privacyTitle'),
      items: [
        { status: 'pending', question: t('sanaa:faq.infoAccessQ') },
        { status: 'approved', question: t('sanaa:faq.reviewActivityQ'), answer: t('sanaa:faq.reviewActivityA') },
        { status: 'pending', question: t('sanaa:faq.customerInfoHandledQ') },
        { status: 'approved', question: t('sanaa:faq.turnOffQ'), answer: t('sanaa:faq.turnOffA') },
      ],
    },
  ];
}
