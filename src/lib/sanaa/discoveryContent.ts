// Structured local content for SANAA Discovery Home (P2). Deliberately plain
// data, not a CMS -- SANAA-P2-SPEC §41. Keep new copy here, not scattered
// across component files, so it's easy to review/edit without touching JSX.

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

export const SANAA_DEMO_SCENARIOS: SanaaDemoScenario[] = [
  {
    id: 'booking',
    title: 'Book an Appointment',
    description: 'A customer calls asking to get in this week.',
    kind: 'simulation',
    outcomeLabel: 'Appointment Booked',
  },
  {
    id: 'reschedule',
    title: 'Reschedule',
    description: 'A customer needs to move their existing appointment.',
    kind: 'media',
  },
  {
    id: 'cancel',
    title: 'Cancel',
    description: 'A customer can no longer make it in.',
    kind: 'media',
  },
  {
    id: 'question',
    title: 'Customer Question',
    description: 'A customer asks about services, pricing, or hours.',
    kind: 'media',
  },
  {
    id: 'transfer',
    title: 'Human Transfer',
    description: 'SANAA hands the call to a real person when needed.',
    kind: 'media',
  },
  {
    id: 'after_hours',
    title: 'After Hours',
    description: 'A customer calls after the salon has closed for the day.',
    kind: 'media',
  },
];

export interface SanaaCapability {
  icon: string; // Ionicons glyph name, kept as string to avoid importing Ionicons types here
  label: string;
}

// Exactly the 6 categories locked in SANAA-P2-SPEC §17 -- do not expand into
// a feature inventory; detailed subclaims are P3's decision.
export const SANAA_CAPABILITIES: SanaaCapability[] = [
  { icon: 'call-outline', label: 'Answers calls' },
  { icon: 'calendar-outline', label: 'Books appointments' },
  { icon: 'swap-horizontal-outline', label: 'Reschedules & cancels' },
  { icon: 'help-circle-outline', label: 'Answers customer questions' },
  { icon: 'person-outline', label: 'Transfers when needed' },
  { icon: 'moon-outline', label: 'Works after hours' },
];

export interface SanaaHowItWorksStep {
  step: number;
  label: string;
}

// SANAA-P2-SPEC §20 -- call mechanics only, zero technical/architecture
// terms anywhere in this copy (§21 is a hard rule).
export const SANAA_HOW_IT_WORKS_STEPS: SanaaHowItWorksStep[] = [
  { step: 1, label: 'Your customer calls' },
  { step: 2, label: 'SANAA answers' },
  { step: 3, label: 'SANAA uses your configured Book With AI business information' },
  { step: 4, label: 'SANAA takes approved actions and updates Book With AI' },
];

export interface SanaaComparisonRow {
  dimension: string;
  human: string;
  sanaa: string;
}

// Qualitative only -- no dollar figures (none are verified/approved). This
// entire section stays __DEV__-only regardless of SANAA_DISCOVERY_LIVE; see
// SANAA_COMPARISON_APPROVED below.
export const SANAA_COMPARISON_ROWS: SanaaComparisonRow[] = [
  { dimension: 'Availability', human: 'Limited to working hours', sanaa: 'Configurable, including after hours' },
  { dimension: 'Missed calls', human: 'Possible during busy moments', sanaa: 'Designed to always pick up' },
  { dimension: 'Coverage', human: 'One call at a time', sanaa: 'Handles calls without pulling you off a client' },
  { dimension: 'Consistency', human: 'Varies by mood, training, day', sanaa: 'Follows your configured rules every time' },
];

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
export const SANAA_FAQ_GROUPS: SanaaFaqGroup[] = [
  {
    title: 'Getting Started',
    items: [
      { status: 'approved', question: 'What is SANAA?', answer: 'SANAA is your AI receptionist inside Book With AI -- she answers your salon’s calls so you never have to leave a client to pick up the phone.' },
      { status: 'approved', question: 'What can SANAA do?', answer: 'She answers calls, books, reschedules and cancels appointments, answers common questions, transfers to a real person when needed, and can work after hours.' },
      { status: 'approved', question: 'Is SANAA a real person?', answer: 'No -- SANAA is an AI receptionist. She never pretends to be a human employee.' },
      { status: 'pending', question: 'How difficult is setup?' },
      { status: 'approved', question: 'Can Book With AI set SANAA up for me?', answer: 'Yes -- alongside self setup, a concierge option exists for salons who’d rather have it done for them. Details on that option are coming soon.' },
    ],
  },
  {
    title: 'Calls & Phone',
    items: [
      { status: 'pending', question: 'What happens to my current salon number?' },
      { status: 'pending', question: 'Do I need another number?' },
      { status: 'approved', question: 'Can SANAA transfer calls to me?', answer: 'Yes -- SANAA can hand a call to a real person when needed.' },
      { status: 'approved', question: 'Can I pause SANAA?', answer: 'Yes -- you can pause SANAA at any time from her Operations screen.' },
      { status: 'approved', question: 'Does SANAA answer after hours?', answer: 'Yes -- after-hours coverage is one of her core capabilities.' },
    ],
  },
  {
    title: 'Appointments',
    items: [
      { status: 'approved', question: 'Can SANAA book appointments?', answer: 'Yes -- booking is her hero capability.' },
      { status: 'approved', question: 'Can SANAA reschedule appointments?', answer: 'Yes.' },
      { status: 'approved', question: 'Can SANAA cancel appointments?', answer: 'Yes.' },
      { status: 'approved', question: 'How does SANAA know my availability?', answer: 'She reads your salon’s real schedule in Book With AI.' },
    ],
  },
  {
    title: 'SANAA & Customers',
    items: [
      { status: 'approved', question: 'Will customers know SANAA is AI?', answer: 'Yes -- SANAA never intentionally impersonates a human employee.' },
      { status: 'pending', question: 'What happens if SANAA doesn’t know an answer?' },
      { status: 'pending', question: 'Can I control what SANAA says?' },
      { status: 'pending', question: 'What languages does SANAA support?' },
    ],
  },
  {
    title: 'Plans & Billing',
    items: [
      { status: 'pending', question: 'How does SANAA pricing work?' },
      { status: 'pending', question: 'Is there an activation fee?' },
      { status: 'pending', question: 'Can I change plans?' },
      { status: 'pending', question: 'Can I cancel?' },
      { status: 'pending', question: 'What happens if my payment fails?' },
    ],
  },
  {
    title: 'Privacy & Control',
    items: [
      { status: 'pending', question: 'What information can SANAA access?' },
      { status: 'approved', question: 'Can I review SANAA’s activity?', answer: 'Yes -- every call is visible in her Calls & Activity screen.' },
      { status: 'pending', question: 'How is customer information handled?' },
      { status: 'approved', question: 'Can I turn SANAA off?', answer: 'Yes, any time -- pausing SANAA stops her from answering calls immediately.' },
    ],
  },
];
