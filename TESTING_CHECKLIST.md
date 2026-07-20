# Step 19 — Exhaustive Pre-Submission Test Roadmap

**Purpose:** the complete, screen-by-screen, button-by-button test script before Google Play Store submission. Every screen in both apps (customer mode and salon-owner mode, including the new staff-facing mode) was either freshly re-read from source (for older screens) or authored this session (for Sprints 7–8 and Step 18.7) to build this list — nothing here is guessed from memory of what a screen "probably" does.

**Status key:** ⬜ not yet tested · 🔵 tested during dev, not a formal pass · ✅ verified in a real pass (note the date) · 🐛 confirmed bug, tracked separately.

**How to use this:** work through the phases in order below. Each phase is a coherent chunk of the app you can test in one sitting. Check off every line — "every button, every icon" is the standard. When you find something broken, mark it 🐛 with a one-line note rather than stopping the whole pass.

---

## Fixed before this pass started (2026-07-19)

Two Play Store submission blockers found while building this checklist, fixed immediately rather than left for later:
- ✅ Removed the dev-only "Reset Onboarding" button (wiped AsyncStorage, explicitly marked "REMOVE BEFORE SUBMISSION" in code) — was still live in both the guest and signed-in Account screen states.
- ✅ Added an in-app "Delete My Data" link in Account → Legal — the screen existed (`legal/delete-account.tsx`) but had no navigation path to it anywhere, a real Google Play User Data policy gap.

## Fixed live (2026-07-20)

- ✅ **Real in-app account deletion built, ahead of iOS submission.** Researched Apple App Store Guideline 5.1.1(v) end-to-end: it requires users to initiate account deletion *from within the app*, and explicitly does not accept an email/support-flow-only process (what the previous "Delete My Data" screen did — just linked to a web page with a mailto action) unless the app is in a "highly regulated industry" (finance/healthcare), which this isn't. Built a real `DELETE /api/mobile/account` endpoint in `booking-app` (deletes the Supabase auth user, cascades `profiles`/`customer_profiles` automatically; per-salon `customers` rows and booking history intentionally left in place, matching what's already publicly disclosed) and rebuilt `legal/delete-account.tsx` as a real in-app flow (typed "DELETE" confirmation + destructive `Alert.alert`, no `Alert.prompt`, matching `account-security.tsx`'s established pattern). Renamed the Account screen's link from "Delete My Data" to "Delete My Account" to match what it now actually does. **Needs a live end-to-end test** (create a throwaway test account, delete it, confirm the auth user and profile are actually gone) before this can be marked fully verified.

- ✅ **In-app "Support" link pointed to `bookwithai.app/support`, which wasn't a real page and wasn't in `middleware.ts`'s public allow-list** — same class of bug as the earlier missing delete-account page. Unauthenticated visitors were silently redirected to `/login` instead of seeing support info; a real Google Play rejection risk (dead/broken link from the app). Built a real public Support page (`booking-app/src/app/(app)/support/page.tsx` — contact email, common questions, link to Delete My Data) and added `/support` to the allow-list. Deployed to production and **confirmed live and working.**

## Full real-device confirmation pass on production build versionCode 8 (2026-07-20)

Everything below tested live on a real phone against the actual Play Store Internal Testing build, not dev mode:

- ✅ **All customer auth paths**: Google OAuth, Magic Link, email sign-in, and create-account — all working cleanly, no dead-ends.
- ✅ **All 4 legal links** (Privacy, Terms, Support, Delete My Data) working on both customer and owner sides.
- ✅ **Full customer booking flow end-to-end**: browse → book → pay → confirmation, including Add to Calendar, Get Directions, and Share all working.
- ✅ **Owner Google OAuth sign-in lands correctly on the owner dashboard** — no recurrence of the customer-side routing glitch, across a real device confirmation (the `AuthContext.tsx` `loading`-state fix is holding).
- ✅ **Full checkout flow**: Check-In → Start → Finish → Ready for Checkout → Complete Checkout, confirmation email received on completion.
- 🐛 **Confirmed again, still open: booking notifications don't reach the Android system tray.** In-app (My Booking list + notification bell) correctly reflect new bookings, but no OS-level push notification appears. Not a submission blocker (in-app notifications work), but a real gap — needs investigation into push token registration / notification channel setup / server-side send before this can be called fully fixed.

## Fixed, not yet retested (2026-07-19, end of session)

- ✅ **Google Sign-In still spun forever after real Google consent completed** (confirmed live on production build -- got the "you shared account data" email from Google, app never picked it up). Root cause: `WebBrowser.openAuthSessionAsync()`'s resolved result was never firing on Android, because the app's own deep-link handling (the same system that used to show "Unmatched Route" for this exact URL, then landed on the `auth/callback.tsx` spinner after that fix) was claiming the redirect intent first, leaving `openAuthSessionAsync()`'s promise permanently unresolved. Fixed by moving the actual code exchange out of `handleGoogleSignIn()` (`auth/index.tsx`) and into `_layout.tsx`'s central `handleDeepLink()`, the same proven-reliable path already used for staff invites and password resets -- `handleGoogleSignIn()` now just opens the browser and doesn't depend on its return value. **Confirmed working live (2026-07-20).**
- ✅ **Magic Link reported with the same "sent, but can't get back into the app" symptom, now confirmed fixed (2026-07-20).** Was covered by the same central-deep-link-handler fix as Google Sign-In (both use the identical `auth/callback` redirect target) -- confirmed working live.

## Fixed live during this pass

- ✅ `booking/review.tsx`'s cancellation-policy consent checkbox was invisible (no fill, border color nearly identical to the new lavender screen background), which blocked checkout entirely since Confirm Booking stays disabled until it's checked. Gave it a white fill + darker border. Checked the same pattern in `services.tsx`/`staff.tsx` — those checkboxes/radios sit inside white cards, so unaffected.
- ✅ Calendar grid misalignment on `booking/datetime.tsx` — dates drifted out of their correct weekday column as the month went on, because the grid relied on `flexWrap` to break rows at 7 cells but the fixed `CELL_SIZE` didn't evenly divide the container width, so some rows wrapped at 8-9 cells. Rewrote to render explicit weekly rows of exactly 7 cells (also fixed the unpadded final week).
- ✅ Removed unused `android.permission.RECORD_AUDIO` from `app.json` — no code in the app uses audio/microphone; an unused sensitive permission is a real Play review flag. Needs a native rebuild to take effect in the built APK.
- ✅ Email format validation (live inline, red text) added across all 4 auth screens; phone number made required + validated on Sign Up; password now requires 8+ chars/upper/lower/number with live feedback; Sign Up "Missing info" alert now lists exactly which fields are wrong instead of a generic message.
- ✅ Sign Up now shows a "By creating an account, you agree to our Terms and Privacy Policy" line with working links — previously no consent/legal link existed on that screen at all.
- ✅ `account-security.tsx`: Android keyboard was hiding the PIN fields/Save button (KeyboardAvoidingView had no Android behavior, and ScrollView never auto-scrolls a focused input into view). Fixed with `behavior="height"` on Android + explicit `scrollToEnd` on PIN field focus.
- ✅ Sign-in/sign-up password field eye-icon toggle button was oversized (`height: '100%'` inside a flex row with no explicit height) — replaced with `alignSelf: 'stretch'` in both `sign-in.tsx` and `sign-up.tsx`.
- ✅ Notification tap did nothing (only marked as read) — now navigates to My Bookings, scrolls to, and highlights the linked booking (`notifications.tsx` + `my-booking.tsx`).
- ✅ **Real Play Store submission blocker, found and fixed cross-repo:** the in-app "Delete My Data" link pointed to `bookwithai.app/delete-account`, which wasn't a real route and wasn't in `middleware.ts`'s public-route allow-list, so it silently redirected to the login page — meaning the app had no working account-deletion path at all. Built a real public page (`booking-app/src/app/(app)/delete-account/page.tsx`) explaining what's deleted/retained and a working "Request Account Deletion" mailto action; added the route to the public allow-list; committed and deployed to production (Vercel). Verified live.
- ✅ **Critical: a real salon owner's mobile login (browsandnailsbytina@gmail.com) landed in customer mode instead of the owner dashboard — fixed and verified.** Confirmed via SQL that `profiles.role = 'owner'` and RLS (`auth.uid() = id`) were both correct — this was a client-side bug in `AuthContext.tsx`'s `loadProfile()`: it silently defaulted to `'customer'` on any query failure with zero error logging, and had no guard against a stale/overlapping profile fetch (e.g. from a sign-out still in flight) resolving after a newer one and clobbering the correct role. Added error logging and a request-sequencing guard (`latestProfileRequest` ref) so only the most recently requested user's result can write state. Retested live: she now lands correctly on the owner Dashboard on sign-in.
- ✅ Owner "More" menu's unbuilt/locked features (Inventory, Expenses, Taxes, Permissions, Marketing, Reviews, Campaigns, Referrals, Promotions, SANAA, Automation, Insights, Voice Calls, AI Rules, all Hardware items, Support, About, Legal) previously just looked greyed-out/broken with no explanation — added a "Coming Soon" badge to every item with no `route` in `(owner)/more.tsx`.
- ✅ **Real customer data (173 rows) confirmed to exist for a live salon but the app's Customers tab showed an empty "Your customer list starts here."** Root cause: `customers.tsx` silently swallowed any `listCustomers()` fetch failure — same known pattern already flagged for the merge-duplicates screen — so a transient auth/network failure right after sign-in looked identical to "genuinely no customers." Added proper error state + retry via the shared `ErrorState` component. **Note:** the Reports tab showing empty for this same salon is not a bug — it's a Sprint 0 shell (Sprint 10 builds the real feature); reworded its copy so it reads as "Coming Soon" instead of implying data will appear once it exists.
- ✅ **Customers list had no pagination at all — only the first 50 (alphabetically) of 173 real customers were ever reachable by browsing.** `load()` hardcoded `listCustomers(q, 0, 50)` with no way to fetch subsequent pages, and the `FlatList` had no `onEndReached`. Since this salon happens to have 50+ customer records starting with "A", the list appeared to silently truncate after the A's with no indication more existed (search still worked since it hits the API fresh each time, unaffected by the missing pagination). Added real infinite-scroll pagination (`page`/`hasMore` state, `onEndReached`, footer spinner) so scrolling loads subsequent pages.
- ✅ **No way to remove a staff member.** The Staff screen had an "Add staff member" button but nothing to remove one, despite the backend (`PATCH /api/owner/staff/[id]`) and client API (`updateStaff`) already fully supporting `active: false`. Added a confirm-then-deactivate "Remove staff member" action to each staff card in `owner-settings/staff.tsx` (soft-remove — doesn't delete past appointment/commission history).
- ✅ **Time Off's start/end dates were free-text `YYYY-MM-DD` inputs** — error-prone for real use. Built a reusable pure-JS `CalendarDatePicker` component (no native date-picker dependency, so no rebuild needed) reusing the correctly-aligned weekly-row grid from the earlier booking-calendar fix, and wired it into `owner-settings/time-off.tsx`'s Start/End date fields with min-date guards (can't pick a past start date, or an end date before the start date). **Note:** `staff.tsx`'s "Add a day-off exception" form has the same free-text single-date pattern — same component could be applied there too if wanted, left as-is since it wasn't part of what was asked.
- ✅ Time Off's "Missing info" alert now lists exactly which field(s) are missing (staff member / start date / end date) instead of always listing all three — this surfaced a real bug while testing: the staff-selection chip wasn't the issue, the alert was just too vague to show that staff selection specifically hadn't registered.
- ⚠️ **Deferred, real gap: no way to revoke an already-approved/denied time-off request.** `PATCH /api/owner/staff/time-off/[id]` explicitly blocks any status change once a request is no longer `pending` ("This request has already been decided"), and there's no delete/cancel endpoint at all. Approving also creates schedule-override rows via `expandTimeOffToOverrides` that would need a matching "undo" — this is real backend work (new endpoint + override-reversal logic + UI), not a quick wiring fix. Not a submission blocker — deferred to post-submission. Workaround until built: none in-app; would need direct DB correction.
- ⚠️ **Deferred, post-submission polish: owner Calendar visual design pass, starting with Week view.** `MultiDayView.tsx` gives every day column a fixed 150px width regardless of `numDays`, so Week mode (7 columns) only ever shows ~2-3 days on screen and requires a horizontal swipe to see the rest — confirmed the data itself is correct (all 7 days do load), it's purely a layout/sizing issue. Owner's ask: Week should show all 7 days on screen without swiping, and the calendar's overall look should get a general visual polish pass. Not attempted now — flagged for later since it's a real design task (compact per-day columns need their own layout, not just a width tweak) rather than a quick fix.
- ⚠️ **Deferred (not a submission blocker), needs investigation: owner reported Search, Notifications bell, and "+" on the Calendar header all "don't work."** Confirmed from code: **Search** is a genuine, intentional no-op everywhere — `OwnerScreenHeader`'s `onSearchPress` prop is documented as "Sprint 0 shell only," never wired by any screen. **Notifications bell** (`→ /owner-notifications`) and **"+"** (`→ walkInRef.current?.present()`, same function as the separate already-working "Walk-In" button lower on the screen) both *look* correctly wired in `(owner)/calendar.tsx` — root cause unconfirmed since live testing was deferred. Needs a real on-device check post-submission: if bell/+ truly do nothing, dig into why despite the code looking right (possible touch-target/z-index overlap); either way, Search needs a "Coming Soon" affordance like the other stub features rather than silently doing nothing.
- ✅ **`_layout.tsx`'s cold-start splash screen was hiding before the async role decision finished**, briefly exposing the customer `(tabs)/book` route before correctly redirecting to the owner dashboard (root-caused via diagnostic logging with a real testclient@gmail.com login: `setSplashVisible(false)` fired as the very first line of `handleSplashDone()`, before the ~4-second onboarding/session/biometrics/profile-fetch chain completed). Fixed by moving `setSplashVisible(false)` to right before each of the 4 exit-point `router.replace()` calls, so the splash covers the whole decision window. **Retested with a second diagnostic-logging pass** (also re-added and re-removed, matching this same fix cycle): after an intermediate reload where it briefly recurred, the fully reloaded app resolved `role: 'owner'` correctly and landed on `/(owner)/dashboard` cleanly across two consecutive cold launches with no errors — confirmed via full log trace, not just visual observation. Treating as resolved; worth a final spot-check with a couple more accounts if time allows before submission.
- ✅ **`(owner)/calendar.tsx`'s Month view (and every other mode) got permanently stuck on a spinner** — traced to the same class of root cause: a "Not signed in" error from `getBusiness()`, surfaced only after adding proper error handling (see the entry above this one) where there'd previously been a silent infinite spinner. This "Not signed in" was very likely a symptom of the same session/role-routing timing issue just above, not a separate bug — once the routing fix held clean, this should be resolved too, but **needs an explicit retest** of Calendar → Month specifically to confirm, since it wasn't directly re-verified in the final clean log pass. The error-handling improvement (real "Couldn't load your business settings: [reason]" message + Try Again button) stays regardless — it's a real improvement over an infinite spinner even if this specific cause is gone.
- ✅ **REAL root cause of the recurring owner-routing-to-customer-tabs bug, finally found with conclusive evidence (2026-07-19), after two prior fixes that each only partially helped.** Captured real `[DIAG]`-tagged logs via `adb logcat` during a live sign-in on the emulator. Timestamps proved it definitively: `AuthRedirectGate` redirected to `/(tabs)/book` using `role: null` at 19:19:57.778 -- a full 4 seconds *before* `loadProfile()`'s DB query even returned (`role: 'owner'` didn't arrive until 19:20:01.958). Root cause: `AuthContext.tsx`'s `loading` state is never reset to `true` at the start of a *new* `onAuthStateChange` event -- it stays at whatever value it had from the *previous* settled auth state while the new `loadProfile()` call is in flight. `AuthRedirectGate` sees `loading: false` (stale) and treats it as safe to redirect using the still-stale `role`. This explains why the earlier splash-timing and request-sequencing fixes each seemed to work sometimes: neither touched this gap, and it only surfaces when the profile fetch is slow enough for a redirect to sneak in before it resolves (a few seconds here on the emulator; likely similar or worse on a cold real-device network). Fixed by adding `setLoading(true)` as the first line of the `onAuthStateChange` handler. **Needs a clean retest** (multiple accounts, a couple of cold launches) to confirm this actually closes it for good, given the history of this bug.
- ✅ **Owner "Log Out" button reported not working — root-caused and fixed.** Confirmed: signing out left the user stuck on their last screen until a force-close/reopen. Root cause: `AuthRedirectGate` in `_layout.tsx` only handled one direction (redirecting a signed-in user away from `/auth`) — it had no logic for the reverse case, a user who just signed out. Fixed by adding an `else if (!user && !onAuthStack)` branch that redirects to `/auth`. **Confirmed working live.**
- 🐛 **New customer booking's push notification reached the owner app (banner arrived), but the bell icon / in-app notification list didn't reflect it.** Reported live during testing, not yet root-caused — needs checking whether the owner-side notification-insert path (that presumably triggers the push) is also correctly writing to whatever table `owner-notifications.tsx` / the bell badge reads from, or if those two are out of sync.
- 🐛 **New: the customer-side Notifications screen (`notifications.tsx`) showed salon-owner-audience notifications** ("FARHEEN DHANANI booked Balayage for...", "Test Customer booked Eyebrow Threading...") **for testclient@gmail.com's account, instead of customer-relevant notifications.** Observed live while this account was (incorrectly, mid-bug) routed to the customer tabs. Not yet root-caused — needs checking whether notifications are properly scoped/filtered by audience (owner vs. customer) for accounts, or whether this account's underlying data is simply mixed test data from earlier sessions rather than a real filtering bug.
- ✅ **Owner Calendar reported "not loading" — reproduced and root-caused via screenshot: it wasn't Calendar broadly, specifically Month view showed only a stuck spinner forever.** Traced to `(owner)/calendar.tsx`'s render gate `loading || !business || !schedule`, which blocks *every* view mode (even Month/Agenda/Timeline, which don't need this data) on a single `getBusiness()` call that silently swallowed failures with no error state and no retry — same silent-failure pattern already fixed twice today. Added a `businessError` state and a real `ErrorState`-with-retry instead of an infinite spinner. **Needs a retest** to confirm the underlying `getBusiness()` failure itself doesn't recur now that it's visible (if it does, the actual fetch failure will need separate investigation).
- ✅ **Calendar's Day/3-Day/Week/Month/Agenda/Timeline mode-selector tabs were visually squished/overlapping live on device** (confirmed not just a screenshot artifact) — the horizontal `ScrollView`'s `contentContainerStyle` had no `alignItems: 'center'` and `modeRow` had no explicit height, so the pill row's cross-axis sizing was ambiguous. Fixed with `alignItems: 'center'` on the content container, an explicit `height: 40` on `modeRow`, `justifyContent: 'center'` on each chip, and an explicit `lineHeight` on the chip text. **Retested and confirmed clean on device.**
- ✅ **The two gap-filling banners ("0.5h opening today — worth filling") looked like an exact duplicate** — confirmed via code that `findEmptySpaces()` cannot actually produce duplicate entries (single pass over sorted bookings, each gap has distinct start/end times); these were two genuinely different real gaps that happened to both be 30 minutes long. The banner text only showed duration, not *when*, making distinct gaps indistinguishable. Fixed by adding the actual start time to the message (e.g. "0.5h opening at 11:00 AM"). **Retested and confirmed showing distinct times (8:30 AM and 11:00 AM) on device.**

## Fixed, awaiting next build (found during real-device Phase 2 testing, 2026-07-19)

- ✅ **Google Sign-In stranded the user on the web app instead of returning to the mobile app.** Two stacked root causes, both confirmed live on real device: (1) Supabase's Redirect URLs allow-list only had the web callback (`https://bookwithai.app/api/auth/callback`), missing the mobile app's custom scheme (`bookwithai://auth/callback`) — Supabase silently falls back to the Site URL when the requested `redirectTo` isn't allow-listed, landing the user on the web app instead. Fixed by adding `bookwithai://auth/callback` to the allow-list (Supabase Dashboard config, not code). (2) After fixing that, the redirect back into the app hit Expo Router's auto-navigation with no matching route at `auth/callback`, showing "Unmatched Route." Fixed by adding `src/app/auth/callback.tsx` — a minimal loading-spinner landing screen matching the existing pattern used for the staff-invite deep link (`auth/staff-invite.tsx`); the actual code exchange already happens in `handleGoogleSignIn()` via `WebBrowser.openAuthSessionAsync`, this just gives Router somewhere to land while `AuthRedirectGate` picks up the new session. **Needs retest on the next build** — this app has no EAS Update/OTA configured, so the route-file fix can't be verified until a full rebuild.

## Fixed, awaiting next build (real-device Phase 6-8 findings, 2026-07-19)

- ✅ **Tab bar (Book/My Booking/Account, and equivalents for owner/staff shells) hidden under the phone's system gesture navigation bar.** Confirmed live on a real device (Z Fold 7). Root cause: all three tab layouts (`(tabs)/_layout.tsx`, `(owner)/_layout.tsx`, `(staff)/_layout.tsx`) hardcoded `tabBarStyle.height`/`paddingBottom` with no awareness of the device's bottom safe-area inset — recent Android versions enforce edge-to-edge display by default, so the system nav bar overlays the app instead of reserving its own space. Not caught earlier since prior testing used an emulator configured with 3-button nav (a fixed opaque bar, not an overlay). Fixed by adding `useSafeAreaInsets()` to all three layouts and folding `insets.bottom` into height/padding. **Confirmed working live on real device.**
- ✅ **Owner Calendar header's "+" and notifications-bell icons genuinely don't work on a real device** (Search confirmed still an intentional stub, unrelated). Root cause: same class of bug as above but at the top of the screen — `OwnerScreenHeader.tsx` (shared by Calendar/Dashboard/Customers/Reports/More) had no safe-area-inset handling, so its icon row rendered too close to the top and was likely partially under the status bar's touch-intercepting region on the Fold 7, while the lower, unaffected "Walk-In" button (calling the identical `walkInRef.current?.present()`) worked fine. Fixed by adding `useSafeAreaInsets()` to `OwnerScreenHeader.tsx` and folding `insets.top` into its top padding — fixes all 5 screens that use this shared header at once. **Confirmed working live — "+" opens Walk-In correctly.**
- ⚠️ **Owner Calendar had no pull-to-refresh at all — added, but not yet confirmed working.** `RefreshControl` wired into `TimelineCalendar.tsx`'s Day-mode `ScrollView`, driven by a new `refreshing`/`handleRefresh` state in `calendar.tsx`. Tested on the emulator and the pull gesture didn't visibly trigger it — likely an emulator touch/gesture-simulation limitation (mouse-drag pull-to-refresh is often unreliable on emulators) rather than a real app bug. Not a submission blocker either way. **Needs a real-device retest** to confirm before fully closing out.
- ℹ️ **Not a bug, confirmed correct:** Walk-In flow's "every staff member is busy" message when the salon is closed and there are no working staff to find a chair for — this is the intended behavior, verified against real "salon closed" state.
- ✅ **Check-In / No-Show / other Appointment Sheet actions appeared to do nothing — status label never changed.** Confirmed live: backend update succeeds (booking correctly showed "Late" once time passed, and pulling down to refresh did reflect changes), but the open sheet doesn't visually update. Root cause, verified in code: `calendar.tsx` sets `selectedBooking` once on open and never re-syncs it — `handleChanged()` correctly calls `reload()` (refetches fresh `bookings`), but the sheet keeps rendering the stale object it opened with. Not a Realtime/backend issue — `useOwnerBookings.ts`'s Supabase Realtime subscription is a separate mechanism for reflecting *other* sessions' changes, unrelated to this same-session staleness bug. Fixed with a `useEffect` that re-derives `selectedBooking` from the live `bookings` array by id whenever it updates. **Needs retest on next build.**

## Flagged, not yet fixed — triage these as you test

These are real findings from reading the actual code, not guesses. Decide fix-vs-accept as you hit each one during testing rather than fixing blind:

- ✅ **"Ready for Checkout" button did nothing anywhere in the app — real root cause found via diagnostic logging, not a touch/timing issue.** Confirmed via `[DIAG]` logs: the tap handler fired, `checkoutRef` was never null, and `CheckoutSheet`'s data (`preview`) loaded successfully every time -- yet the sheet never visually appeared. Root cause: `CheckoutSheet` was rendered **nested inside** `AppointmentSheet`'s own `BottomSheetModal` (as a child, not a sibling) in all three places `AppointmentSheet` is used (`(owner)/calendar.tsx`, `(owner)/dashboard.tsx`, `customer/[id].tsx`). `@gorhom/bottom-sheet` requires `BottomSheetModal` instances to be direct children of the shared `BottomSheetModalProvider`, not nested inside another modal's content -- nesting confines the inner modal to the parent's render context instead of the app-level portal, so `.present()` silently does nothing visible. This was broken everywhere checkout could be triggered, not just Calendar. Fixed by lifting `checkoutRef`/`CheckoutSheet` out of `AppointmentSheet` in all three call sites, rendering it as a sibling instead, with a new `onReadyForCheckout` callback prop replacing `AppointmentSheet`'s internal ref.

  **That fix alone wasn't enough — real library bug, confirmed via `onChange` instrumentation and matching public GitHub issues.** Even as a sibling, `.present()` never triggered `@gorhom/bottom-sheet`'s own `onChange` callback at all -- proof the library's internal state genuinely never transitioned, not a rendering/data problem on our side. Tried a dismiss-then-present sequence (50ms, then 400ms delay) to rule out an animation-timing race between the closing Appointment Sheet and the opening Checkout Sheet -- neither changed the outcome. Web search confirmed multiple open GitHub issues describing this exact symptom (`present()` called, ref valid, nothing opens, no error) in `@gorhom/bottom-sheet` v5.

  **Final fix: replaced `CheckoutSheet`'s presentation layer with React Native's own built-in `Modal`, removing the `@gorhom/bottom-sheet` dependency for this one component entirely.** All checkout business logic (pricing, tenders, submit, etc.) is untouched -- only the "how it appears on screen" wrapper changed, via a small internal `SheetModal` helper (backdrop + rounded slide-up panel) and a `useImperativeHandle`-based `{ present, dismiss }` API replacing the `BottomSheetModal` ref contract. **Confirmed working live** -- full Check-In → Start → Finish → Ready for Checkout → Complete Checkout flow now functions end-to-end. This was the most serious functional bug found all session (a salon literally could not complete a sale) and the hardest to root-cause -- three real diagnostic passes before the fix, exactly matching the three-strikes-then-change-approach rule.
- 🐛 **Checkout rebook checkbox may not be wired up.** In the owner Checkout Sheet, the "rebook suggestion" checkbox sets local state (`bookNext`) but that value does not appear to be included in the `submitCheckout` payload — verify whether checking it actually books a follow-up appointment, or is currently inert.
- 🐛 **Commission rate input can visually desync from saved state.** The per-staff commission input in Services → Staff panel is an uncontrolled `TextInput` (`defaultValue`, saves on blur). An invalid entry (out of 0–100 range) is rejected server-side, but the on-screen text isn't reset — the field can show a value that was never actually saved.
- 🐛 **Silent failures on some archive/delete actions.** `products.tsx`'s trash icon shows no error alert if `archiveProduct` fails (services.tsx does alert on failure — inconsistent). Same gap on Business Settings' closure-removal trash icon.
- 🐛 **Merge-duplicates fetch failure is indistinguishable from "no duplicates."** If `getMergeCandidates()` fails (network/auth error), the screen shows the same empty state as a genuinely clean customer list — no distinct error message.
- 🐛 **On-screen keyboard doesn't appear on Staff screen text fields (likely elsewhere too) when using the emulator with a laptop/hardware keyboard connected.** Typing itself works correctly — text enters the field fine via the physical keyboard, confirmed by user. Very likely standard Android emulator behavior (soft keyboard is suppressed when a hardware keyboard is detected), not an app bug. Deferred per user instruction; needs confirmation on a real device or with the emulator's "show virtual keyboard" / hardware-keyboard setting toggled off before ruling out entirely.
- 🐛 **Receipt screen may only show one service.** `booking/receipt.tsx` takes a singular `serviceName` param, unlike Confirmation's `||`-joined multi-service list — verify a multi-service booking's receipt doesn't silently drop services.
- 🐛 **Potential double-charge risk on Payment screen retry.** If the booking-creation POST fails *after* Stripe has already charged the card, tapping "Pay" again re-presents the PaymentSheet — verify the Stripe SDK actually prevents a second charge on a since-consumed client secret rather than assuming it does.
- 🐛 **Biometric icon may mislabel devices with no biometric hardware.** `auth/biometrics.tsx` defaults `biometricType` to `'none'` but the icon-selection logic falls through to a fingerprint icon/label regardless — test on a device/emulator with zero biometric hardware.
- ⚠️ **`book.tsx`'s manual salon-slug entry field is commented "DEV TOOL, replace with deep link hint for prod."** Product decision, not a bug: confirm whether to keep it as a real fallback entry method or replace before submission.
- ⚠️ **No maximum-attempt lockout on the PIN entry screen** (`auth/pin-entry.tsx`) — unlimited guesses at a 4-digit PIN. Worth a security-review sanity check even though the underlying account still requires the real password/biometric for anything sensitive.
- 🐛 **Forgot Password email link doesn't reliably hand off to the app (undone, revisit later).** Code-side is in place: `forgot-password.tsx` now passes `redirectTo` (custom scheme), a `reset-password.tsx` screen exists, `_layout.tsx` handles the deep link, and the Supabase Redirect URLs allow-list has `bookwithai://auth/reset-password` added. Live test still failed — the Gmail-wrapped link (`google.com/url?q=...`) has a malformed/under-encoded `redirect_to` param, and Chrome hung during the multi-hop redirect. Needs a clean retest with the unwrapped Supabase verify URL before marking this done.
- 🐛 **Sign-up confirmation email not received (undone, revisit later).** After deleting a test account in Supabase and re-signing-up from the app with the same email, the "Check your email" alert appeared as expected, but no confirmation email ever arrived. Sign-in still worked afterward (account wasn't actually blocked on confirmation), so the functional impact is unclear — needs investigation into whether email confirmation is required/enforced at all, and why Supabase isn't sending/delivering the mail (check Supabase email logs / SMTP config, and whether "Confirm email" is even enabled for this project).
- 🐛 **Booking confirmation push notification didn't reach the Android system tray (undone, revisit later).** The "Booking Confirmed" notification showed correctly in the app's own in-app Notifications screen, but never appeared in the Android status bar / notification drop-down. Needs investigation into whether the push token registration, notification channel setup, or the server-side send is the gap — check `requestAndRegisterPushToken` in `_layout.tsx` and the owner push notification call sites.
- ⚠️ **Deferred UX feature: staff-specific calendar availability.** `booking/datetime.tsx`'s calendar currently shows every date as selectable regardless of which staff member is chosen — it doesn't gray out days that staff member isn't working, or flag fully-booked days red. Fixing this needs a new month-level availability endpoint (the existing `/api/availability` in `booking-app` only returns slots for one already-selected date) plus calendar UI wiring here. Not a submission blocker — deferred to post-submission polish.

## Needs a physical device — emulator can't verify these

The emulator has no real biometric hardware, so these can only be confirmed on an actual phone before submission:
- ⬜ **Biometric Login end-to-end.** Emulator correctly shows the "Not available" fallback message when no biometric hardware is enrolled (confirmed working) — but the actual enroll → toggle on → unlock-with-fingerprint/face flow needs a real device to verify.

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

- ✅ Onboarding flow confirmed working end-to-end on real device, 2026-07-19 (real production build, not dev mode)

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
