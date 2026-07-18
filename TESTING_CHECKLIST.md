# Pre-Submission Testing Checklist

**Purpose:** one running list of every testable behavior across both apps (customer + owner), built up as features ship so nothing has to be re-derived from memory right before Android submission (Step 19/20). This is the script for that one full pass — go top to bottom, on a real device, check every box.

**How to keep this current:** every session that ships a feature or fixes a bug adds its test cases here before wrapping up — same discipline as the `MASTER.md` build-notes habit. Items are grouped by feature area, not by sprint, so the list stays usable as a checklist rather than a changelog. When a regression is found and fixed, its test case stays here permanently (see "Known regressions to re-check" at the bottom) — those are exactly the things that silently break again.

**Status key:** ⬜ not yet tested end-to-end on a device · 🔵 tested during dev (emulator, ad hoc) but not part of a formal pass · ✅ verified in a real pass, date noted.

---

## A. Customer App

### A1. Auth & Onboarding
- ⬜ Fresh install → onboarding slides → sign up (email) → lands on Book tab
- ⬜ Sign up → magic link flow completes and signs in
- ⬜ Sign in with existing email/password
- ⬜ Forgot password → reset email → new password works
- ⬜ Google OAuth sign-in
- ⬜ Biometric lock: enable in Account tab → background/reopen app → Face ID/fingerprint prompt appears
- ⬜ Biometric prompt → "Use Password Instead" fallback works
- ⬜ Biometric prompt → "Use PIN Instead" fallback appears only when a PIN is set (`account-security.tsx`), and only after biometrics fail/are unavailable
- ⬜ PIN entry: correct 4-digit PIN unlocks; wrong PIN shows "Incorrect PIN" and clears input
- ⬜ Sign out (local) → app requires sign-in again but other devices stay signed in
- ⬜ "Log out of all devices" (`/account-security`) → confirm dialog → signs out this device AND invalidates sessions elsewhere (verify: sign in on two devices, log out-all on one, other device's next request fails)

### A2. Booking Flow
- ⬜ Salon landing page loads: name, hours, policies, address, logo, phone all render (regression check — see bottom)
- ⬜ Call button opens dialer with correct number; only shows when salon has a phone number
- ⬜ Directions button opens maps app with correct address; only shows when address exists
- ⬜ Select one service → Continue → staff list shows only staff assigned to that service (if any assignment exists) or all staff (if none)
- ⬜ Select multiple services → staff list shows the **intersection** of staff who can perform all selected services
- ⬜ Select "Any Available" staff → skips to datetime picker
- ⬜ Datetime picker shows real open slots respecting business hours + existing bookings
- ⬜ Datetime picker: no slots available shows a real empty state, not a blank screen
- ⬜ Review screen: notes field, consent checkbox required before Continue
- ⬜ Salon with `require_online_payment = false` or $0 total → booking created directly, skips Stripe, confirmation shows "Due at Salon"
- ⬜ Salon with online payment required → Stripe PaymentSheet opens, test card completes payment, confirmation shows "Paid"
- ⬜ Payment failure (declined test card) → real error shown, booking NOT created, can retry
- ⬜ **Idempotency**: submit a booking, kill network right after tapping Pay/Confirm before response returns, reopen app, retry — should NOT create a duplicate booking (same `idempotency_key` reused across the retry)
- ⬜ Confirmation screen: Add to Calendar → real calendar event created with correct time/title
- ⬜ Confirmation screen: Get Directions opens maps
- ⬜ Confirmation screen: Share button → native share sheet opens with correct appointment text
- ⬜ Confirmation screen → Done → lands on My Booking tab, new booking visible

### A3. My Bookings — Upcoming
- ⬜ Upcoming confirmed booking outside cutoff window: Reschedule + Cancel buttons show
- ⬜ Upcoming booking inside cutoff window: only "Contact Salon" shows (Call/Text via salon phone)
- ⬜ Reschedule → datetime picker preloaded with same service/staff → new time saved, list updates
- ⬜ Cancel → confirmation dialog shows salon's cancellation/reschedule policy text → confirms → booking removed/marked cancelled, salon owner gets a push
- ⬜ Pull-to-refresh on My Booking list updates without a full reload

### A4. My Bookings — Past
- ⬜ Past/completed booking shows Rebook, Rate (if not yet reviewed), Receipt actions; cancelled past bookings show only Rebook
- ⬜ Rebook → jumps to staff-selection screen prefilled with the same service, salon
- ⬜ Rate → inline star picker expands in place (not a modal, not `Alert.prompt`) → submit → star rating saved, "Rate" button disappears on next load (backend `reviewed` flag)
- ⬜ Rate a booking twice → second attempt is blocked server-side ("already been rated")
- ⬜ Receipt → opens receipt screen with correct service, staff, date, price, tax, tip, total
- ⬜ Receipt screen → Share button → native share sheet with formatted receipt text

### A5. Existing Customer Summary
- ⬜ Signed-in customer with prior bookings at a salon → salon landing page shows "Welcome back" card: visit count, total spent, last visit date
- ⬜ Customer with an active reward/promo code at that salon → banner shows reward available
- ⬜ Customer with a birthday within 7 days → birthday banner shows
- ⬜ Brand-new customer at a salon (no prior bookings) → summary card does not appear at all
- ⬜ Signed-out visitor → summary card never appears (route requires bearer auth)

### A6. Account Security
- ⬜ Change email → confirmation email sent to NEW address → clicking it completes the change → old email no longer signs in
- ⬜ Change password: wrong current password → rejected with clear message, password NOT changed
- ⬜ Change password: correct current password + valid new password → succeeds, can sign in with new password
- ⬜ Set a PIN → 4 digits, mismatched confirm → rejected; matching confirm → saved
- ⬜ Change an existing PIN → old PIN no longer works, new one does
- ⬜ Remove PIN → confirm dialog → PIN fallback option disappears from biometrics screen

### A7. Profile
- ⬜ Upload profile photo → permission prompt (if first time) → picker → crop → uploads → avatar updates on Account tab and Profile screen
- ⬜ Profile photo persists after app restart (public URL from `profile-photos` bucket)
- ⬜ Set birthday (MM/DD/YYYY) → invalid format rejected with clear message → valid date saves
- ⬜ Select pronouns chip → toggle off by tapping again → saves as null
- ⬜ Timezone auto-detects correctly and displays
- ⬜ Profile fields persist and reload correctly after backgrounding/restarting the app
- ⬜ Book a single service with a specific staff member at Salon A → preference silently saved; verify at Salon B it does NOT apply (per-salon scoping) — needs direct DB check or a future "preferred" surfacing UI, since there's no visible confirmation today

### A8. Offline / Error Handling
- ⬜ Airplane mode on → red "No internet connection" banner appears at the top, app-wide
- ⬜ Airplane mode off → banner disappears automatically
- ⬜ Salon landing page load with no connection → `ErrorState` with "Try Again" shown, not a blank/frozen screen
- ⬜ Services/staff picker load with no connection → same `ErrorState` + retry pattern
- ⬜ My Booking list load with no connection → same `ErrorState` + retry pattern
- ⬜ Datetime slot fetch failure → existing inline error message + retry (pre-existing, re-verify still works)
- ⬜ Retry button on any `ErrorState` actually re-fetches and recovers once connection is back

### A9. Push Notifications
- ⬜ First successful booking → OS permission prompt appears right after confirmation screen
- ⬜ Permission granted → "Booking Confirmed" push arrives as a real OS banner (not just in-app)
- ⬜ Deny permission → Account tab toggle reflects "off", tapping it deep-links to system Settings
- ⬜ Re-enable in system Settings → Account tab toggle reflects "on" next time the tab is focused
- ⬜ Reschedule a booking → "Appointment Updated" push arrives
- ⬜ Cancel a booking → "Appointment Cancelled" push arrives
- ⬜ 24h reminder (day-before, 6pm) arrives for a tomorrow booking — needs a real overnight wait to verify
- ⬜ 2h reminder arrives — needs a real same-day wait to verify
- ⬜ In-app notification inbox (bell icon) shows history, unread badge count correct, tapping marks read
- ⬜ Two devices signed into the same account both receive pushes (multi-device token support)

---

## B. Owner App

### B1. Foundation / Auth / Nav
- ⬜ Owner account signs in → routes to owner shell (5-tab nav), not customer tabs
- ⬜ Role detection correct for every existing real owner account (not just newly-created ones — this depends on the Sprint 2 `profiles.role='owner'` backfill matching by email)
- ⬜ Bottom-sheet framework opens/closes cleanly across all owner screens that use it (Appointment Sheet, Checkout Sheet)

### B2. Business Setup + Services + Staff
- ⬜ Edit business address (line 1/2, city, state, postal code) → saves, reflects on customer-facing salon page
- ⬜ Set a holiday/closed date → reflected in SANAA's call-handling too (shared `sanaa_holidays` table)
- ⬜ Add/edit/archive a service → shows/disappears correctly on customer booking flow
- ⬜ Add/edit staff member, set weekly availability → affects available datetime slots on customer side
- ⬜ **New this session:** expand a service's "Staff" panel → toggle staff on/off → save → customer-side staff picker for that service reflects the assignment immediately
- ⬜ Toggle all staff off a service (back to "any staff") → customer-side picker shows everyone again
- ⬜ Morning Brief time picker saves and the cron actually respects the configured hour

### B3. Calendar + Appointments
- ⬜ Day view: long-press + drag an appointment to a new time → saves, conflict-checked
- ⬜ Day view: drag across staff columns → reassigns staff, conflict-checked
- ⬜ Pinch-to-zoom on the timeline works smoothly
- ⬜ Swipe right on an appointment → checks in; swipe left → advances state machine
- ⬜ Live red "now" line updates in real time
- ⬜ Walk-in flow: search/quick-create customer → pick service → auto-finds earliest open chair → books
- ⬜ Conflict detection: attempt to double-book a staff member → real error shown, drag/walk-in reverts
- ⬜ 3-Day / Week / Month / Agenda / Timeline views all render correctly (read-only, no drag expected)
- ⬜ Appointment three-dot menu: no-show, duplicate, lock, restore, bulk cancel, bulk shift all work
- ⬜ Realtime: a booking made on the customer app appears on the owner calendar within seconds, no manual refresh

### B4. Customer Directory / CRM
- ⬜ Customer search + quick-create from Directory and from Walk-in flow
- ⬜ Customer detail: notes CRUD (add/pin/delete)
- ⬜ Photo/document upload to a customer record, RLS-scoped correctly (owner can't see another salon's customer media)
- ⬜ Merge duplicate customers → combines history correctly, doesn't lose bookings
- ⬜ Spending Timeline chart renders real data
- ⬜ Customer Health score + AI Insights show plausible, non-fabricated values (rule-based v1, not random)
- ⬜ Communications timeline merges email/SMS/call logs correctly for a customer with activity across all three
- ⬜ Preferred staff field on a customer record — reflects the fire-and-forget signal from the mobile booking flow

### B5. Checkout & Payments
- ⬜ "READY FOR CHECKOUT" opens Checkout Sheet from the Appointment Sheet
- ⬜ Add a product mid-checkout → total recalculates correctly, including tax (regression check — see bottom)
- ⬜ Apply a discount → tax recomputes against the new subtotal, not frozen from initial preview
- ⬜ Card payment → generates a Stripe Checkout link, customer completes on their own device, booking finalizes on webhook
- ⬜ Cash/store-credit/mixed-tender checkout completes and records `checkout_payments` rows correctly
- ⬜ Store credit balance updates correctly after use
- ⬜ Refund flow issues a real refund and updates records
- ⬜ Departure Intelligence checklist + rebook suggestion + End-of-Visit summary all show correct data
- ⬜ Service upgrade at checkout → correct new price/service reflected in the final charge

### B6. Dashboard + Notifications
- ⬜ Dashboard Health Score + AI Insights + revenue/appointments/clients/occupancy snapshot all show real numbers
- ⬜ Occupancy is computed from real `staff_availability`, not a placeholder
- ⬜ New booking/cancel/reschedule/SANAA events all generate an owner push notification (all 9 call sites — regression risk if any gets missed in future changes)
- ⬜ Notification Center list is Realtime-backed — new notification appears without manual refresh
- ⬜ Mark-read updates badge count correctly
- ⬜ Morning Brief cron fires once daily at the configured hour, doesn't double-send (dedup via `morning_brief_last_sent_date`)

### B7. Daily Operations
- ⬜ Business status toggle (open/closed/interrupted) with a reason — inline form, not `Alert.prompt` (regression check — see bottom)
- ⬜ Multi-day business closures — distinct from single-day holidays, both apply correctly
- ⬜ Business announcements post and are visible where expected
- ⬜ Opening/closing checklist — fixed items, completion state persists per day
- ⬜ Staff schedule overrides (single-day exception to weekly availability) affect that day's available slots only
- ⬜ Priority-customer flag surfaces that customer first in the Waiting Queue
- ⬜ Waiting Queue expected-wait estimate is computed from the real in-service booking's duration
- ⬜ Daily booking capacity cap actually blocks new bookings once reached
- ⬜ Add-On Suggestion only appears after ≥3 real occurrences and ≥30% frequency — verify it does NOT show for a service with no real co-occurrence history (i.e., not fabricated)
- ⬜ Live elapsed-service timer counts up correctly during an in-service appointment

---

## C. Known regressions to re-check every full pass

These were real bugs, caught and fixed once already — they're exactly the kind of thing that silently breaks again after an unrelated change, so they stay on the list permanently rather than being treated as "done."

- ⬜ **`Alert.prompt` is iOS-only.** Any text-input dialog anywhere in the app (business status reason, holiday dates, etc.) must be an inline form, never `Alert.prompt` — verify on a real Android device, not just the emulator, since this bug hid on iOS-flavored testing before.
- ⬜ **Tax recompute on checkout.** Adding a product or discount mid-checkout must recompute tax live against the current subtotal, not the frozen value from the initial preview call.
- ⬜ **`profiles.role='owner'` backfill correctness.** Every real pre-existing owner account (not just new ones) must route to the owner shell, not the customer tabs — this depends on an email-match backfill that only ran once.
- ⬜ **RLS doesn't silently zero out existing web queries.** Any new RLS policy on a previously-open table should be checked against `ExpensesView.tsx`/`AatifAgent.tsx`-style direct browser queries before shipping — confirm the web dashboard still works after any owner-app RLS change.
- ⬜ **Idempotency key dedup.** A retried booking submission (e.g., app backgrounded mid-request, tapped Pay twice) must never create two bookings.
- ⬜ **Salon landing page fields.** `owner_phone`, `address_line1`/`address_line2`/`postal_code`, and `logo_url` (joined from `brand_studio_settings`) must all actually render — this silently regressed once already (wrong field names, `tsc` caught it but the UI bug shipped invisibly for a while first).
- ⬜ **Cancellation push parity.** Cancel and reschedule use two different backend routes — confirm both still send their respective push after any booking-route refactor.
- ⬜ **`require_online_payment` respected end-to-end.** A salon with pay-at-salon enabled must never route to Stripe; this was broken once by a setting that was fetched but never actually checked.
