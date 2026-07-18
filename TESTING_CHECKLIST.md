# Step 19 — Exhaustive Pre-Submission Test Roadmap

**Purpose:** the complete, screen-by-screen, button-by-button test script before Google Play Store submission. Every screen in both apps (customer mode and salon-owner mode, including the new staff-facing mode) was either freshly re-read from source (for older screens) or authored this session (for Sprints 7–8 and Step 18.7) to build this list — nothing here is guessed from memory of what a screen "probably" does.

**Status key:** ⬜ not yet tested · 🔵 tested during dev, not a formal pass · ✅ verified in a real pass (note the date) · 🐛 confirmed bug, tracked separately.

**How to use this:** work through the phases in order below. Each phase is a coherent chunk of the app you can test in one sitting. Check off every line — "every button, every icon" is the standard. When you find something broken, mark it 🐛 with a one-line note rather than stopping the whole pass.

---

## Fixed before this pass started (2026-07-19)

Two Play Store submission blockers found while building this checklist, fixed immediately rather than left for later:
- ✅ Removed the dev-only "Reset Onboarding" button (wiped AsyncStorage, explicitly marked "REMOVE BEFORE SUBMISSION" in code) — was still live in both the guest and signed-in Account screen states.
- ✅ Added an in-app "Delete My Data" link in Account → Legal — the screen existed (`legal/delete-account.tsx`) but had no navigation path to it anywhere, a real Google Play User Data policy gap.

## Flagged, not yet fixed — triage these as you test

These are real findings from reading the actual code, not guesses. Decide fix-vs-accept as you hit each one during testing rather than fixing blind:

- 🐛 **Checkout rebook checkbox may not be wired up.** In the owner Checkout Sheet, the "rebook suggestion" checkbox sets local state (`bookNext`) but that value does not appear to be included in the `submitCheckout` payload — verify whether checking it actually books a follow-up appointment, or is currently inert.
- 🐛 **Commission rate input can visually desync from saved state.** The per-staff commission input in Services → Staff panel is an uncontrolled `TextInput` (`defaultValue`, saves on blur). An invalid entry (out of 0–100 range) is rejected server-side, but the on-screen text isn't reset — the field can show a value that was never actually saved.
- 🐛 **Silent failures on some archive/delete actions.** `products.tsx`'s trash icon shows no error alert if `archiveProduct` fails (services.tsx does alert on failure — inconsistent). Same gap on Business Settings' closure-removal trash icon.
- 🐛 **Merge-duplicates fetch failure is indistinguishable from "no duplicates."** If `getMergeCandidates()` fails (network/auth error), the screen shows the same empty state as a genuinely clean customer list — no distinct error message.
- 🐛 **Receipt screen may only show one service.** `booking/receipt.tsx` takes a singular `serviceName` param, unlike Confirmation's `||`-joined multi-service list — verify a multi-service booking's receipt doesn't silently drop services.
- 🐛 **Potential double-charge risk on Payment screen retry.** If the booking-creation POST fails *after* Stripe has already charged the card, tapping "Pay" again re-presents the PaymentSheet — verify the Stripe SDK actually prevents a second charge on a since-consumed client secret rather than assuming it does.
- 🐛 **Biometric icon may mislabel devices with no biometric hardware.** `auth/biometrics.tsx` defaults `biometricType` to `'none'` but the icon-selection logic falls through to a fingerprint icon/label regardless — test on a device/emulator with zero biometric hardware.
- ⚠️ **`book.tsx`'s manual salon-slug entry field is commented "DEV TOOL, replace with deep link hint for prod."** Product decision, not a bug: confirm whether to keep it as a real fallback entry method or replace before submission.
- ⚠️ **No maximum-attempt lockout on the PIN entry screen** (`auth/pin-entry.tsx`) — unlimited guesses at a 4-digit PIN. Worth a security-review sanity check even though the underlying account still requires the real password/biometric for anything sensitive.

---

## Testing Roadmap — phases, in order

1. **Fresh install & onboarding** (Phase 1)
2. **Customer auth** (Phase 2)
3. **Customer booking flow, end to end** (Phase 3)
4. **Customer My Bookings, Account, Profile** (Phase 4)
5. **Customer offline/error handling** (Phase 5 — see Section C below, unchanged from last pass)
6. **Owner auth & shell** (Phase 6)
7. **Owner Dashboard** (Phase 7)
8. **Owner Calendar — all 6 view modes, gestures, walk-in, appointment sheet, checkout** (Phase 8 — the single biggest phase)
9. **Owner Customers list + CRM detail screen** (Phase 9)
10. **Owner Settings — Business, Products, Services** (Phase 10)
11. **Owner Staff Management — roles, PIN/invite, clock-in kiosk, time off** (Phase 11)
12. **Owner CRM Depth — memberships, packages, tags, referrals, relationship timeline** (Phase 12)
13. **Staff-facing app (individual accounts mode)** (Phase 13)
14. **Cross-cutting regression sweep** (Phase 14 — Section D, run last, every item here has broken once before)

---

## Phase 1 — Fresh Install & Onboarding

- ⬜ Fresh install → 4 onboarding slides render correctly (manual swipe is intentionally disabled — only Next/Skip/dots drive navigation)
- ⬜ "Skip" (slides 1–3) jumps straight to the final CTA slide
- ⬜ "Next" through all 3 intro slides advances correctly, progress dots update
- ⬜ Final slide: "Get Started" → marks onboarding done, lands on `/auth`
- ⬜ Final slide: "Sign In" → marks onboarding done, lands on `/auth/sign-in`
- ⬜ Relaunching the app after onboarding is complete skips straight past onboarding
- ⬜ Root `/` and `/explore` redirect stubs resolve to `/book` without a visible flash or crash

## Phase 2 — Customer Auth

- ⬜ "Continue with Google" opens OAuth browser sheet, completes sign-in, redirects into the app
- ⬜ Cancelling the Google OAuth sheet returns cleanly with the button re-enabled, no error
- ⬜ "Create an Account" / "Sign In with Email" / "Send me a magic link instead" navigate correctly
- ⬜ "Terms" / "Privacy Policy" inline links from the Auth Welcome screen open the correct legal pages
- ⬜ Sign-in: empty email/password → "Missing info" alert; wrong credentials → "Sign in failed" alert; correct credentials → lands on the right home screen for the account's role
- ⬜ Eye icon toggles password visibility on both Sign In and Sign Up
- ⬜ Sign-up: empty fields → "Missing info"; password < 8 chars → "Weak password"; valid submission → "Check your email" confirmation, routes to sign-in
- ⬜ Magic link: empty email → alert; valid submission → "sent" state with correct echoed email, "Send again" returns to form with email preserved
- ⬜ Forgot password: empty email → alert; valid submission → "Email sent!" state; "Back to Sign In" works (note: no resend option here, unlike magic link — confirm intentional)
- ⬜ Biometrics screen auto-triggers the OS prompt on mount; success routes by role; cancel/fail leaves user on-screen with no error shown (confirm this silent-fail UX is acceptable)
- ⬜ "Use PIN Instead" only appears when a PIN was previously set; "Use Password Instead" always available
- ⬜ PIN entry: correct 4-digit PIN unlocks and routes by role; wrong PIN clears dots and shows "Incorrect PIN"; backspace works; keypad blank cell is inert

## Phase 3 — Customer Booking Flow (full walkthrough)

- ⬜ Salon page: loading/error(retry)/not-found states all correctly triggered; logo/initial-placeholder, hours, address, all 3 policy cards each independently conditional on data presence
- ⬜ Call button only shows with a phone number; Directions only shows with an address; both open correctly (note: Directions is hardcoded to Apple Maps URL scheme even on Android — verify actual Android behavior)
- ⬜ "Welcome back" summary card only shows for signed-in, existing (non-new) customers; birthday and rewards banners conditionally correct
- ⬜ Services: category grouping, multi-select toggle, footer total price/duration, Continue only visible once ≥1 selected
- ⬜ **Staff filtering: selecting 2+ services shows only staff who can perform ALL of them (intersection) — test explicitly with an overlap-of-one case**
- ⬜ "Any Available" vs specific staff selection both work; preference auto-saves silently on Continue (single-service/single-staff only, not multi)
- ⬜ DateTime: past dates disabled, month navigation correct, slot fetch loading/error/empty states, **staff name shown on slot chips only when no staff was pre-selected**
- ⬜ **180-second hold timer**: countdown visible, selecting a new slot restarts it, letting it expire clears the selection and hides the footer
- ⬜ Reschedule flow (from My Bookings): header/button text changes to "Reschedule"/"Confirm Reschedule", success routes to My Booking, failure preserves selection for retry
- ⬜ Review: notes optional, consent checkbox gates the Proceed button, correct button label/behavior for both skip-payment and online-payment branches
- ⬜ **Idempotency: retry a failed skip-payment booking submission and confirm no duplicate booking is created** (same key reused across retries)
- ⬜ Payment (Stripe): PaymentSheet loads, Google Pay appears on a real Android build, cancel is silent (no error shown), payment failure shows retry-able error, success creates the booking and lands on Confirmation
- ⬜ **Payment retry after a post-charge booking-creation failure — verify no double charge** (see flagged item above)
- ⬜ Confirmation: push permission auto-requests once; Add to Calendar (permission-gated, disables after success); Get Directions (platform-specific URL); Share opens native share sheet; Done routes to My Booking with no way back to Payment/Review
- ⬜ Receipt screen: itemized breakdown correct, Share button works, **verify multi-service bookings show all services, not just one** (see flagged item)
- ⬜ Full happy path end-to-end, both with and without online payment required, params propagate correctly across all 6 screens with no loss

## Phase 4 — Customer My Bookings, Account, Profile

- ⬜ My Booking: not-signed-in / loading / error+retry / empty / populated states all correct
- ⬜ Pull-to-refresh works without a full-screen loader flash
- ⬜ Upcoming outside cutoff: Reschedule + Cancel (with policy text in the confirm dialog) both work
- ⬜ Upcoming inside cutoff: only "Contact Salon" shows, Call/Text intents both work
- ⬜ Past bookings: Rebook always available; **Rate only for completed+unreviewed, inline star picker (not Alert.prompt), submit/cancel both work, reviewed state hides Rate immediately without a refetch**; Receipt only for completed
- ⬜ Notifications: read/unread visual states, tap-to-mark-read, **long-press deletes with zero confirmation — verify this is intentional**, realtime-independent pull-to-refresh, per-focus refetch
- ⬜ Account tab: profile header → Profile screen; Biometric toggle (hardware/enrollment gated); Push toggle (reflects real OS permission, re-checked on focus); Legal section including the new Delete My Data link; Sign Out confirmation flow
- ⬜ Profile: photo upload (permission-gated, crop, upload spinner), birthday format validation (**note: no calendar-validity check, e.g. "02/30" would pass the regex** — verify server catches it), pronoun single-select toggle, read-only auto-detected timezone, Save success/failure alerts
- ⬜ Account Security: change email (weak validation, confirmation-email flow), change password (re-auths with current password first), PIN set/change/remove (inline forms, no Alert.prompt), Log Out of All Devices (global sign-out)
- ⬜ Legal screens (Privacy/Terms/Support/Delete My Data): auto-open in-app browser, fallback "Open X" button if auto-open fails, **confirm all 4 URLs are actually live on production before submission** — dead links are a common Play Store rejection reason

## Phase 5 — Customer Offline/Error Handling
(unchanged from prior pass — see Section C below for the full list; re-run it as part of this phase)

## Phase 6 — Owner Auth & Shell

- ⬜ Owner account signs in → routes to the 5-tab owner shell (Dashboard/Calendar/Customers/Reports/More), not customer tabs
- ⬜ Role detection correct for every existing real owner account, not just newly created ones
- ⬜ Tab bar: exactly 5 tabs, correct icons/labels/active-state coloring, no 6th tab or FAB anywhere

## Phase 7 — Owner Dashboard

- ⬜ Loading/stuck-spinner behavior if `getDashboard()` fails (verify it doesn't hang forever silently)
- ⬜ Header bell → Owner Notifications; search/+ icons are inert (unimplemented, confirm expected)
- ⬜ Greeting text correct by time of day; health score expand/collapse and color thresholds (green ≥80, amber 50–79, red <80... below 50)
- ⬜ AI Insight cards only render for non-empty entries
- ⬜ **Daily Ops card**: status picker (Open/Closed/Interrupted) with inline reason form for Closed/Interrupted (not Alert.prompt); announcements post/dismiss; checklist tab switch + item toggle, correctly scoped to today's date
- ⬜ **Waiting Queue**: only shows checked-in-not-started bookings, priority sorts first, live wait timer (red past 10 min), expected-wait estimate computed from the in-service booking's real duration
- ⬜ Snapshot cards (Revenue/Appointments/Clients/Occupancy) and revenue trend arrow direction/color
- ⬜ Next Appointment card only shows when a matching booking exists; tapping opens the Appointment Sheet
- ⬜ Today's Timeline strip (excludes cancelled bookings) and Quick Actions row all navigate correctly
- ⬜ No pull-to-refresh on Dashboard — confirm this is expected

## Phase 8 — Owner Calendar (biggest phase — budget real time)

- ⬜ Header +/bell; Yesterday/Tomorrow date nav; "Today" label logic
- ⬜ **All 6 view mode chips switch correctly: Day, 3-Day, Week, Month, Agenda, Timeline** — only one active at a time
- ⬜ Day-mode-only controls (staff filter row, Walk-In button, Select button, alert/gap banners) correctly hidden in all other modes
- ⬜ Staff filter "All" vs specific staff chip filtering
- ⬜ Gap banners (≥30 min empty spaces, max 2) tap to open Walk-In
- ⬜ **Timeline grid: pinch-zoom (0.6x–2.4x, persists), live red "now" line (today only, within business hours), block sizing/coloring by status**
- ⬜ **Long-press + drag to move an appointment** (time-only and cross-staff-column reassignment); conflict rejection springs the block back with an error; in-flight dim state; tap-in-place doesn't fire a spurious API call
- ⬜ **Fling right = check-in; fling left = advance state machine one step** — both only fire when that's actually the valid next action
- ⬜ Bulk select mode: multi-select, +15/-15 min shift, Cancel-all (with destructive confirm), failure preserves selection for retry
- ⬜ Agenda/Timeline-strip/Month/3-Day/Week modes: correct read-only rendering, Month's day-tap jumps to Day mode, 3-Day/Week explicitly has no drag gestures (verify long-press does nothing there)
- ⬜ **Walk-In flow**: customer search (2+ char threshold, "will be added as new" hint), service single-select, earliest-open-chair algorithm across staff, race-condition handling ("just got booked" retry message), quick-create-then-book path
- ⬜ **Appointment Sheet**: header status pill, three-dot menu (Duplicate +7 days, Lock/Unlock, No-Show only when not already terminal, Restore only when cancelled/no-show), elapsed-service timer, add-on suggestion card, sticky action button following the exact state machine, Cancel with destructive confirm
- ⬜ **Checkout Sheet**: checklist pass/fail banner, service upgrade swap, product add/increment, discount chips, tip chips, live-recalculating totals with color-coded Remaining, all 8 tender methods (gift card validation, store credit balance check), Complete Checkout gated on Remaining=0, success view auto-dismiss timing, **verify the rebook checkbox actually affects the outcome** (flagged above), Stripe-pending share-link path vs immediate-complete path

## Phase 9 — Owner Customers List + CRM Detail Screen

**List screen:**
- ⬜ Search (name/phone/email), loading/empty states, **verify empty state doesn't misleadingly show for a no-match search vs a truly empty account**
- ⬜ Duplicate-detection banner (singular/plural text correct) → Merge Duplicates screen
- ⬜ **Merge Duplicates: confirmation dialog wording, per-group merge spinner, success removes the group from the list, failure alert with retry** — **treat this as genuinely destructive/irreversible per the in-app copy itself; verify booking history/notes/spend actually survive under the merged record on the backend, not just that the group disappears from this list**
- ⬜ No pagination/infinite-scroll beyond the first 50 customers visible in this file — confirm this is/isn't a real limitation
- ⬜ Tapping a row opens the customer detail screen

**Customer Detail Screen — every section:**
- ⬜ Header: name, VIP badge (`total_bookings >= 5`), Blocked badge, tappable Priority badge (toggles, stamps `priority_set_at` only on first grant — **verify re-toggling doesn't re-stamp the date**)
- ⬜ **Tag row**: chips show existing tags, tap-to-remove (X icon), "+" opens inline add input (not Alert.prompt), autocomplete suggestion chips from other customers' tags at the same salon, adding/removing persists immediately
- ⬜ Health score pill expand/collapse showing reasons
- ⬜ Quick Actions: Book, Call, Message (SMS), Notes (scrolls to Notes section), More → Delete (destructive confirm, unlinks bookings rather than deleting them)
- ⬜ AI Insights card (birthday-soon, dormancy nudge, high-visit referral-candidate hint) — rule-based, verify it doesn't show fabricated/impossible values
- ⬜ Snapshot: lifetime spend, visits, avg ticket, avg tip, last visit, years as customer, cancellation %, no-show %, and the Preferred Staff picker row (saves immediately on selection)
- ⬜ Upcoming Appointment card (single next booking) opens the Appointment Sheet
- ⬜ Service Timeline: dotted list of past bookings, service + date only
- ⬜ Spending Timeline: sparkline chart of completed-booking amounts
- ⬜ **Membership section**: active memberships list (status, renewal date), "Renew" only shown for manual-billing memberships (hidden for Stripe-subscription ones — those renew automatically), "Cancel" works for both (manual = immediate; Stripe = cancels the real subscription, status updates once webhook confirms), purchase chips for each active plan — **Stripe-mode purchase hands back a real Checkout URL to open/share, verify the "Open" alert flow works**
- ⬜ **Packages section**: active packages list (visits remaining), "Redeem a visit" decrements correctly and rejects at 0 remaining or past expiry, purchase chips grant a new package instantly
- ⬜ Rewards: active `client_promo_codes` list, code/type/value/used-state
- ⬜ Notes: add (with input focus scroll from Quick Actions), pin/unpin, delete
- ⬜ Photos: upload via image picker (permission-gated), thumbnail strip, remove
- ⬜ Documents: upload via document picker, list, remove
- ⬜ Communication: merged email/SMS/push/call timeline with correct icons per channel
- ⬜ **Referrals section**: "Referred by" search-and-pick (a customer cannot refer themselves — verify rejected), referrer's own page shows the referred customer under "Referred by this customer", **Grant Reward creates a real usable promo code for the REFERRER (not the referred customer)**, granting twice is rejected
- ⬜ **Relationship Timeline**: chronological merged feed — joined date, first visit, visit-count milestones (5/10/25/50/100, only ones actually reached), every reward unlocked, membership/package purchases, referrals made, priority-grant date — **verify it doesn't duplicate what Service Timeline or Communication already show; all three should coexist showing genuinely different information**

## Phase 10 — Owner Settings: Business, Products, Services

- ⬜ Business Setup: name/phone/address/policy/max-bookings fields, morning brief hour chips, **staff login mode picker (shared_device vs individual_accounts)** — all save together via the bottom Save button (holidays/closures save independently via their own inline forms)
- ⬜ Holiday Hours: add (all 3 fields required)/remove (no confirm, but DOES alert on failure), stale-value-on-cancel caveat
- ⬜ Business Closures: add (start/end required, reason optional)/remove (no confirm, **does NOT alert on failure — silent gap**, flagged above)
- ⬜ Products: add (name+price required, **no negative/zero price check client-side**)/archive (**no failure alert — silent gap**, flagged above), no edit-existing capability
- ⬜ Services: add (name/duration/price/bookable-online switch)/archive (does alert on failure), no edit-existing capability
- ⬜ **Services → per-service Staff panel** (critical, recently built): expand/collapse (only one open at a time), empty-staff-list message, checkbox toggle autosaves immediately (no explicit Save), hint text switches between "any staff" and "only selected staff" live, **commission rate input only shows for assigned staff, saves on blur, rejects out-of-0–100-range values** (verify the flagged uncontrolled-input staleness issue), re-expanding refetches fresh from server

## Phase 11 — Owner Staff Management (Sprint 7)

- ⬜ Staff screen: existing hours-editor/day-off-exception behavior unchanged; **new Role & Permissions block per staff**: permission role chips (Manager/Receptionist/Stylist/Assistant, autosaves), default commission rate (blur-save, 0–100 validated)
- ⬜ **Shared-device mode**: "Set a clock-in PIN" / "Change PIN" inline form (4-digit + confirm, no Alert.prompt)
- ⬜ **Individual-accounts mode**: "Invite to create an account" → email input → real Supabase invite email sent; row shows "Invite pending (email)" until claimed, then "Account active" once linked
- ⬜ **Clock-in kiosk** (`owner-settings/clock.tsx`): staff chip row shows "On clock" suffix for anyone currently clocked in; tapping a staff member reveals the PIN keypad; correct PIN clocks in/out (label/color changes), wrong PIN rejected with no state change; double-clock-in and double-clock-out both rejected with real errors; recent shifts list updates after every action
- ⬜ **Owner Time Off screen**: pending requests show Approve/Deny; direct-create form (staff picker, date range, reason) auto-approves and immediately blocks that staff's availability in the booking flow; approve/deny on a staff-submitted request updates status and (on approve) blocks availability
- ⬜ Staff invite deep link (`bookwithai://auth/staff-invite`): tapping the real invite email link opens the app and lands on "Set Your Password" (not a broken/unmatched route)
- ⬜ Setting a password links the account and routes into the new 4-tab staff shell, not the customer or owner shell
- ⬜ "Team" group in owner More menu: Staff / Time Off / Clock In-Payroll all navigate correctly; "Permissions" remains an inert placeholder (no custom permission builder was built — confirm expected)

## Phase 12 — Owner CRM Depth (Sprint 8)
(Covered in full under Phase 9's Customer Detail Screen section above — this phase is the plan-management side)

- ⬜ **Membership Plans screen**: add form (name, price, monthly/yearly interval, manual/Stripe billing mode chips, optional discount %, optional included visits/cycle); Stripe-mode creation actually creates a real Stripe Price (verify in the Stripe dashboard) with zero manual Stripe setup required from the owner; archive removes from the active list
- ⬜ **Packages screen**: add form (name, price, included visits, optional expiry days); archive removes from the active list

## Phase 13 — Staff-Facing App (individual accounts mode only)

- ⬜ **Schedule tab**: Clock In/Out button reflects real current status (checks most recent shift), toggling works without a PIN (already authenticated as self); appointment list is **permission-aware — Stylist/Assistant see only their own bookings, Manager/Receptionist see the whole salon's** (verify with accounts of each role)
- ⬜ **Time Off tab**: request form (start/end/reason) submits as "Pending"; list shows own requests with correct status badges; approval/denial by the owner reflects here without the staff member doing anything
- ⬜ **Earnings tab**: total commission card + itemized list (date, rate%, amount) matches what the owner sees on the same staff member's commission view
- ⬜ **Account tab**: shows email, Sign Out works and returns to `/auth`
- ⬜ Sign out and sign back in as a staff member lands directly in the staff shell every time (role persists across sessions)
- ⬜ Log out of all devices / password change (existing account-security screen) also works correctly for a staff-role account

---

## Section D — Cross-cutting regressions to re-check every full pass

These were real bugs, caught and fixed once already — they're exactly the kind of thing that silently breaks again after an unrelated change, so they stay on the list permanently rather than being treated as "done."

- ⬜ **`Alert.prompt` is iOS-only.** Any text-input dialog anywhere in the app must be an inline form, never `Alert.prompt` — verify on a real Android device. (Confirmed zero usages as of this pass — re-`grep -r "Alert.prompt" src/` before every future submission.)
- ⬜ **Tax recompute on checkout.** Adding a product or discount mid-checkout must recompute tax live against the current subtotal, not the frozen preview value.
- ⬜ **`profiles.role='owner'` backfill correctness.** Every real pre-existing owner account must route to the owner shell, not customer tabs.
- ⬜ **RLS doesn't silently zero out existing web queries.** Any new RLS policy on a previously-open table should be checked against direct-browser-query code paths before shipping.
- ⬜ **Idempotency key dedup.** A retried booking submission must never create two bookings.
- ⬜ **Salon landing page fields.** `owner_phone`/address fields/`logo_url` must all actually render — this regressed once already.
- ⬜ **Cancellation push parity.** Cancel and reschedule use two different backend routes — confirm both still send their push after any refactor.
- ⬜ **`require_online_payment` respected end-to-end.** A pay-at-salon salon must never route to Stripe.
- ⬜ **Role routing after any auth-flow change.** `_layout.tsx`'s `roleHome()` must keep routing owner/staff/customer correctly — now a 3-way branch, not 2.
- ⬜ **Commission never double-charges or double-counts.** `booking_commissions`'s unique constraint must prevent a re-finalized checkout from creating a second row.
- ⬜ **Next.js route-export validation.** `tsc --noEmit` does NOT catch a `route.ts` exporting a non-HTTP-method constant — run a real `npm run build` in `booking-app` after touching any route file.
- ⬜ **New table names checked against existing ones before creating.** Grep the codebase for an intended table name before any new migration — a same-named `CREATE TABLE IF NOT EXISTS` silently no-ops against the wrong table.
- ⬜ **Stripe-subscription membership state depends on webhooks arriving.** Verify the Stripe CLI/dashboard event log shows successful delivery after any membership subscription test, not just that the UI eventually looked right.
- ⬜ **Dev-only code paths.** Re-check for any new "REMOVE BEFORE SUBMISSION" markers before every future submission — two were found and fixed this pass; more could be introduced later.
- ⬜ **In-app path to account/data deletion.** Any new account-adjacent screen work should re-confirm the Delete My Data link is still reachable from Account → Legal.
