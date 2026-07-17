# 📱 Book With AI — Expo App MASTER.md
### Single source of truth for the customer mobile app
**Last updated:** 2026-07-16

> Always pull this at the start of every session.
> For platform-wide decisions (SANAA, booking backend, web app), see `C:\Dev\booking-app\MASTER.md`

---

## PREDICTED vs ACTUAL

| Step | Original Estimate | Actual | Notes |
|------|------------------|--------|-------|
| 1 — Repo + Scaffold | 1 session | 1 session (2026-07-15) | On track |
| 2 — Design System | 1 week | 1 session (2026-07-15) | 6 days ahead |
| 3 — Navigation Shell | 1–2 sessions | 1 session (2026-07-15) | On track |
| 4 — Splash + Onboarding | 2–3 sessions | 1 session (2026-07-15) | 1–2 sessions ahead |
| 5 — Auth (mandatory, email/password + Google + magic link + biometrics) | 1–1.5 weeks | 1 session (2026-07-16) | Phone OTP scrapped, rebuilt as full auth gate — weeks ahead |
| 6 — Salon Landing | 1 week | 1 session (2026-07-15) | 6 days ahead |
| 7 — QR Scanner | 1 session | 1 session (2026-07-15) | On track |
| 8 — Service Selection | 1 session | 1 session (2026-07-15) | On track |
| 9–18 — Full booking flow | implied weeks (part of 12–16 wk total) | 1 session (2026-07-15) | Weeks ahead |
| **TOTAL Steps 1–18** | **~12–16 weeks** | **1 day** | **~11–15 weeks ahead of original estimate** |
| 18.5 — Push Notifications (pulled forward from V2) | ~6–8 hours / 1–2 sessions | ✅ Done 2026-07-16 (same day) | Predicted completion was 2026-07-18 — 2 days ahead. Includes 6 bug fixes found during E2E testing (see build plan below). |
| 18.6 — Customer self-serve reschedule/cancel | ~5–6 hours / 1 session | ✅ Done 2026-07-16 (same day) | New gap found during Internal Testing prep. Includes 1 follow-up fix (customer confirmation push was missing on self-serve actions) found and fixed during verification. |
| 19 — Internal Testing | 1–2 sessions | 🔄 Unblocked, ready to resume | — |
| 20 — Android / Google Play | 3–7 days (Google review) | ⬜ | Review wait time unchanged |
| 21 — iOS / App Store | 1–7 days (Apple review) | ⬜ | Review wait time unchanged |
| **Salon Owner App — Sprint 0** (Foundation shell: role-aware auth, 5-tab owner nav, design tokens, bottom-sheet dependency) | 4–6 days, predicted 2026-07-25 | ✅ Done 2026-07-17 (8 days ahead) | Full sprint schedule + reasoning lives in `booking-app/MASTER.md` § SALON OWNER APP — FULL ROADMAP → Sprint Schedule. `profiles` table migration applied to prod via Supabase CLI (`supabase db push`) after installing the CLI and repairing its migration ledger — see that file's Sprint 0 build note for the full story, including a pre-existing duplicate-migration-timestamp bug it surfaced (still open, unrelated to this sprint). |
| **Salon Owner App — Sprint 1** (Business Setup + Services + Staff Foundation) | 5–7 days, predicted 2026-08-04 | ✅ Done 2026-07-17 (18 days ahead) | New screens: `owner-settings/{business,services,staff}.tsx`, reachable from More → Settings/Services/Staff. Business Setup includes address + holiday hours (the two Phase 1 gaps found in the audit). Staff screen includes a simple weekly-hours editor. Full build notes in `booking-app/MASTER.md`. |
| **Salon Owner App — Sprint 2** (Calendar + Appointment Management, scope expanded to include Sprint 4's check-in/service state machine + real Realtime) | 6–8 days, predicted 2026-08-16 | ✅ Done 2026-07-17 (30 days ahead) | Full hour-grid timeline (`TimelineCalendar.tsx`) with drag-to-move, pinch-to-zoom, swipe gestures, live "now" line, Walk-In flow (auto-finds earliest chair), and surfaced conflict detection — completed properly same-day after an initial simplified pass was corrected per the "no partial builds" rule. Full build notes — including a real production-risk RLS issue found and fixed before it shipped — in `booking-app/MASTER.md`. |

> The 12–16 week original estimate was based on a human developer working a few sessions per week.
> AI-assisted coding collapsed the build time to a single day. Store review timelines remain the same — those are Google and Apple's clocks, not ours.

---

## BUILD PROGRESS

| Step | What | Status | Date |
|------|------|--------|------|
| 1 | Repo + Scaffold | ✅ Done | 2026-07-15 |
| 2 | Design System | ✅ Done | 2026-07-15 |
| 3 | Navigation Shell | ✅ Done | 2026-07-15 |
| 4 | Splash + Onboarding | ✅ Done | 2026-07-15 |
| 5 | Auth — mandatory login gate (Email/Password, Google OAuth, Magic Link, Biometrics unlock) | ✅ Done | 2026-07-16 |
| 6 | Salon Landing Screen | ✅ Done | 2026-07-15 |
| 7 | QR Code Scanner | ✅ Done | 2026-07-15 |
| 8 | Service Selection | ✅ Done | 2026-07-15 |
| 9 | Staff Selection | ✅ Done | 2026-07-15 |
| 10 | Date + Time Selection | ✅ Done | 2026-07-15 |
| 11 | Appointment Review | ✅ Done | 2026-07-15 |
| 12 | Payment (Stripe + Google Pay) | ✅ Done | 2026-07-15 |
| 13 | Booking Confirmation | ✅ Done | 2026-07-15 |
| 14 | Deep Linking | ✅ Done | 2026-07-15 |
| 15 | Calendar + Maps | ✅ Done | 2026-07-15 |
| 16 | Legal Screens | ✅ Done | 2026-07-15 |
| 17 | Error Handling Pass | ✅ Done | 2026-07-15 |
| 18 | Native Polish | ✅ Done | 2026-07-15 |
| 18.5 | Push Notifications (pulled forward from V2) | ✅ Done | 2026-07-16 |
| 18.6 | Customer self-serve reschedule/cancel | ✅ Done | 2026-07-16 |
| 19 | Internal Testing | 🔄 Unblocked, ready to resume | 2026-07-15 |
| 20 | Android Build + Google Play | ⬜ | |
| 21 | iOS Build (EAS) + App Store | ⬜ | |

---

## PUSH NOTIFICATIONS BUILD PLAN (Step 18.5)

> Pulled forward from Version 2 (`booking-app/MASTER.md` line ~1868) on 2026-07-16. ETA/traffic "leave now" reminders explicitly stay in V2 — they need salon address/lat-lng data that doesn't exist yet, plus a Google Maps API key not yet wired into `booking-app`, plus a background-location decision that adds Play Store review risk. This build plan is the reduced scope: core notifications only.

**Predicted completion: 2026-07-18** — **Actual: all 6 phases code-complete and deployed 2026-07-16, 2 days ahead.** Only remaining item is the end-to-end device test (see checklist above).

| Phase | What | Repo | Est. | Status |
|-------|------|------|------|--------|
| 1 | Firebase project (`BookWithAI`, reused existing GCP project) + Android app + `google-services.json` (FCM credentials) | Firebase Console (user action) | ~30 min | ✅ Done 2026-07-16 |
| 1b | **New, found mid-build:** link an EAS project (`eas init`) + upload the Firebase FCM V1 service account key to Expo (`eas credentials -p android`) — Expo's push service needs this to actually deliver to Android devices, and `getExpoPushTokenAsync()` needs an EAS `projectId` in app.json's `extra.eas.projectId` | EAS/Expo account (user action) | ~20–30 min | ✅ Done 2026-07-16 — EAS project `bookwithai-app` (ID `09a191e6-4d32-4ef9-9fba-8a9e1eac2213`) linked under `bookwithai` account, FCM V1 service account key uploaded |
| 2 | `push_tokens` + `customers.auth_user_id` + `push_notification_log` migration + `POST/DELETE /api/mobile/push-token` (session-verified) | booking-app | ~30–45 min | ✅ Done 2026-07-16 — migration applied to production |
| 3 | Expo push-send utility wired into booking-created + dashboard reschedule/cancel (`PUT /api/bookings/[id]`) code paths | booking-app | ~1.5–2 hours | ✅ Done 2026-07-16 — deployed to production |
| 4 | `/api/cron/appointment-reminders` endpoint (24h fixed-6pm + 2h reminders, timezone-aware, dedup tracking) | booking-app | ~1–1.5 hours | ✅ Done 2026-07-16 — deployed + cron-job.org running every 15 min |
| 5 | `expo-notifications` + `expo-device` installed, permission request after first booking, Account tab re-enable toggle | bookwithai-expo | ~1–1.5 hours | ✅ Done 2026-07-16 — native rebuild succeeded, installed on Pixel_8 emulator |
| 6 | In-app notification inbox (bell icon, list, read/unread, delete) + app icon badge count | bookwithai-expo | ~1–1.5 hours | ✅ Done 2026-07-16 — built into same rebuild |

**Security note (2026-07-16):** the Firebase service account private key was briefly mis-saved as `eas.json` in the repo root during setup — caught before it was ever committed (confirmed via `git status`/`git ls-files`), then deleted and redone correctly. Added `.gitignore` patterns (`google-services.json`, `*serviceAccount*.json`, `firebase-adminsdk*.json`, etc.) so any Firebase/Google credential file is protected automatically regardless of name, going forward.

**Remaining before this can actually be tested end-to-end:**
1. ~~User: create Firebase project, download `google-services.json`~~ ✅ Done.
2. ~~User: link EAS project + upload FCM V1 credentials~~ ✅ Done.
3. ~~User: apply migration to staging then production Supabase~~ ✅ Done 2026-07-16 — applied directly to production only (staging skipped per user decision).
4. ~~User: add `CRON_SECRET` env var + configure cron-job.org~~ ✅ Done 2026-07-16 — cron-job.org hits `GET /api/cron/appointment-reminders` every 15 min.
5. ~~Deploy `booking-app` (Vercel)~~ ✅ Done 2026-07-16 — commit `7fc517b` live in production (verified via Vercel deployment status).
6. ~~Native rebuild of `bookwithai-expo`~~ ✅ Done 2026-07-16 — build succeeded, installed on Pixel_8 emulator.
7. ~~End-to-end test~~ ✅ Done 2026-07-16 — booking → permission prompt → push arrives → inbox shows history → badge count correct, all verified on emulator.

**STEP 18.5 COMPLETE — 2026-07-16.** Push notifications fully built, deployed, and verified end-to-end.

**Bugs found and fixed during E2E testing (2026-07-16), all verified:**
| Bug | Root cause | Fix |
|-----|------------|-----|
| Mobile app ignored salon's "pay at salon" setting | `require_online_payment` was fetched but never threaded through the booking flow or checked before routing to Stripe | Threaded through salon→services→staff→datetime→review; review.tsx now creates the booking directly (skipping Stripe) when the salon doesn't require online payment or price is $0. Backend `payment_intent_id` made optional. |
| First-ever booking never sent its own "Booking Confirmed" push | `customers.auth_user_id` only got linked during push-token registration (after the confirmation screen) — but the push send happens at booking-creation time, before that ever runs | Mobile app now sends `auth_user_id` with the booking request; backend links it immediately, before attempting the push |
| No notification permission dialog on emulator | `Device.isDevice` check blocked the whole flow pre-emptively on this Play-Store-enabled emulator | Removed the blanket check; wrapped the actual token-fetch call in try/catch instead so it fails gracefully only where genuinely unsupported |
| Notification permission dialog still skipped after above fix | Added a pre-check reading `getPermissionsAsync()` status and skipping if not `'undetermined'` — but Android can't cleanly distinguish "never asked" from "denied" without extra checks the library wasn't doing, so it read as already-decided | Removed the pre-check entirely — just call the request function every time; it and Android's own permission system already correctly implement "ask once" without help |
| Confirmation screen said "Paid" even for pay-at-salon bookings | Label was hardcoded regardless of payment method | Added a `paid` param threaded from payment.tsx (`'true'`)/review.tsx (`'false'`) → shows "Due at Salon" when not actually charged |
| "My Booking" tab always showed "No bookings yet" | Client-side query had **no filter at all** — pre-existing gap from before auth existed, RLS silently blocked everything | New session-verified `GET /api/mobile/my-bookings` endpoint, looks up bookings via `customers.auth_user_id` |
| "Add to Calendar" threw a deprecated-API error | `expo-calendar`'s default export path is deprecated in this SDK version | Changed import to `expo-calendar/legacy` (same API, still supported) |
| Cancellation push never fired (reschedule did) | Dashboard's cancel dialog hits a completely different route (`DELETE /client/bookings/[id]`) than reschedule (`PUT /api/bookings/[id]`) — push was only wired into the latter | Added the same push send to the `DELETE` cancel route. Also fixed stale dialog copy claiming clients are never auto-notified. |

**Cron + notification verification (2026-07-16):** cron-job.org execution history confirmed healthy (200 OK every 15 min, one early 404 during initial setup before deploy finished — not recurring). Reschedule and Cancellation pushes both confirmed arriving as real OS notification banners (not just in-app inbox) by testing live from the salon dashboard. 24h/2h reminder pushes rely on the same verified send path — not separately live-tested yet since that requires waiting for the actual time window (2h) or being at ~6pm local salon time with a "tomorrow" booking (24h); the send mechanism itself (used identically by booking-confirmed/reschedule/cancel) is proven working.

**Local testing workflow (added 2026-07-16):** `src/lib/config.ts` exports `API_BASE`, reading `EXPO_PUBLIC_API_BASE` from `.env.local` (falls back to production). Set it to `http://10.0.2.2:3000` (Android emulator's alias for host machine's localhost) while running `npm run dev` in `booking-app`, to test against a local server before deploying — avoids a deploy-and-wait cycle for every backend change. Not yet applied to all API call sites (`payment.tsx`, `notifications/api.ts`, `registerForPushNotifications.ts` still have their own local constant) — finish wiring this up next time a backend change needs local testing.

**Permission timing (decided 2026-07-16):** request notification permission right after the booking confirmation screen following a user's first successful booking — a natural, in-context moment, avoiding the App Store/Play Store penalty for asking on first launch. Can be changed after launch via a normal app update — not a permanent lock-in, just best to get right for the first store submission.

**Other locked decisions for this build (2026-07-16):**
| Decision | What Was Decided |
|----------|-----------------|
| Multi-device | Support multiple active device tokens per customer account (one row per device, not overwrite-on-login) |
| Notification events | One combined "Booking Confirmed" push covers both payment success and pay-at-salon bookings — not split into separate "payment received" / "booking confirmed" events, since today's flow creates the booking only after payment succeeds anyway |
| Inbox placement | Bell icon in the app header (visible from any tab, badge count on the bell) — not a 4th tab, since 3 tabs (Book/My Booking/Account) are locked |
| 24h reminder timing | Fixed time (6pm the day before), not exactly-24-hours-before-appointment-time, to avoid firing at odd hours |
| Permission re-enable path | Toggle in Account tab — if off, deep-links to the device's system Settings for the app |
| Notification copy | See drafted copy below — approved 2026-07-16 |

**Deferred to V2:** re-prompting for notification permission on every subsequent booking (while still off) via a custom in-app soft-ask banner that deep-links to Settings after the first OS denial. Not built now — only the single first-booking ask + Account tab toggle are in this scope. Add once V1 is approved.

**Rescheduled/Cancelled pushes added to this build (2026-07-16):** small addition to Phase 3 — reuses the existing reschedule/cancel endpoints in `booking-app`, no new feature required.

**Notification copy (approved 2026-07-16, final wording from Farheen):**
| Type | Title | Body |
|------|-------|------|
| Booking Confirmed | `Booking Confirmed` | `You're all set! Your appointment at {salon_name} is confirmed for {date} at {time}.` |
| 24-Hour Reminder | `See You Tomorrow` | `Just a reminder—your appointment at {salon_name} is tomorrow at {time}.` |
| 2-Hour Reminder | `Almost Time` | `Your appointment at {salon_name} starts in 2 hours. See you at {time}.` |
| Appointment Rescheduled | `Appointment Updated` | `Your appointment at {salon_name} has been rescheduled to {date} at {time}.` |
| Appointment Cancelled | `Appointment Cancelled` | `Your appointment at {salon_name} has been cancelled.` |

**Notification copy logged for V2 (needs features that don't exist yet — waitlist system, promotions, reviews):**
| Type | Title | Body |
|------|-------|------|
| Waitlist Available | `Earlier Appointment Available` | `Good news! An earlier appointment is available at {salon_name}. Book it before it's gone.` |
| Favorite Salon Promotion | `Special Offer` | `Your favorite salon has a new offer waiting for you.` |
| Review Request | `How Was Your Visit?` | `Tell us about your experience at {salon_name}. Your feedback helps others discover great professionals.` |

---

## CUSTOMER SELF-SERVE RESCHEDULE/CANCEL BUILD PLAN (Step 18.6)

> Found 2026-07-16 during Internal Testing prep: the mobile app's "My Booking" tab was read-only — no way for a customer to reschedule or cancel their own appointment. Not in the original 21-step plan; added as a new step.

**Predicted completion: same day (2026-07-16), ~5–6 hours.**

**Locked decisions (2026-07-16):**
| Decision | What Was Decided |
|----------|-----------------|
| Cutoff enforcement | Reuse `booking_cutoff_minutes` from `agency_clients` — the exact same field + dropdown salon owners already configure ("Cancellation & rescheduling window" in dashboard settings, default 24h), and the exact same logic SANAA's voice-agent routes already use: `(starts_at - now) < cutoffMinutes` blocks the action. No new salon setting. |
| Refunds | No automatic refund on self-cancel — matches today's dashboard behavior where refund/fees are a manual staff decision. Self-cancel just marks the booking cancelled. |
| Past cutoff | Reschedule/Cancel buttons replaced with "Contact the salon" (Call/Text), not a silent block or a warn-and-allow. |
| Policy visibility | Show the salon's actual free-text `cancellation_policy`/`rescheduling_policy` (the only place this policy lives — it's not a structured/enforceable field) to the customer before they confirm. |

**Build plan:**
| Phase | What | Repo | Est. |
|-------|------|------|------|
| 1 | `POST /api/mobile/bookings/[id]/cancel` — session-verified, ownership check via `customers.auth_user_id`, cutoff check, marks cancelled (`cancelled_by: 'customer'`), no refund, adds a dashboard notification for the salon owner | booking-app | ~1 hour |
| 2 | `POST /api/mobile/bookings/[id]/reschedule` — same ownership + cutoff check (against the *existing* appointment time), verifies new slot availability, updates booking, resets `reminder_24h_sent_at`/`reminder_2h_sent_at`, notifies salon owner | booking-app | ~1 hour |
| 3 | My Booking tab: Reschedule/Cancel buttons on upcoming bookings, cutoff-aware (swaps to Call/Text past cutoff), shows salon's policy text before confirming | bookwithai-expo | ~2–2.5 hours |
| 4 | Reschedule flow reuses existing staff/date/time picker screens, adapted to update instead of create | bookwithai-expo | included in Phase 3 |
| 5 | Testing + bug fixing buffer | both | ~1 hour |

**STEP 18.6 COMPLETE — 2026-07-16.** Reschedule and cancel verified working end-to-end on device: buttons appear correctly on upcoming bookings, actions succeed, cutoff logic in place. One bug found during verification: the new endpoints only notified the salon's dashboard bell, not the customer themselves — fixed by adding the same `sendPushToCustomer` call used on the staff-side routes, so self-serve actions now produce the same push + inbox receipt as staff-initiated ones.

---

## 🔒 ALL LOCKED DECISIONS

| Decision | What Was Decided | Date Locked |
|----------|-----------------|-------------|
| **Framework** | Expo + React Native Web (SDK 57) | 2026-07-15 |
| **Repo** | `SmartAIITSolutions/bookwithai-Expo` | 2026-07-15 |
| **Local folder** | `C:\Dev\bookwithai-expo` | 2026-07-15 |
| **App ID** | `app.bookwithai.app` — permanent, never change | 2026-07-15 |
| **App name** | Book With AI | 2026-07-15 |
| **Platform order** | Android first → iOS after Android approved | 2026-07-15 |
| **Phase order** | Phase 1 (customer app) fully done + in both stores BEFORE Phase 2 (salon owner) starts | 2026-07-15 |
| **iOS builds** | Expo EAS cloud builds — no Mac needed | 2026-07-15 |
| **Expo cost** | Free tier to start. $29/month only if OTA updates exceed 1,000/month | 2026-07-15 |
| **Navigation** | Expo Router with standard `Tabs` (not experimental NativeTabs) | 2026-07-15 |
| **Tabs (V1)** | 3 tabs — Book, My Booking, Account | 2026-07-15 |
| **Fonts** | Sora (body/UI) + Fraunces (headings/display) — matches web app | 2026-07-15 |
| **Auth** | Email+Password + Google OAuth + Magic Link. Biometrics for return visits. No phone OTP. | 2026-07-15 |
| **Payments** | Stripe React Native + Google Pay (V1). Apple Pay in V3. | 2026-07-15 |
| **SANAA in customer app** | Not in V1. Future version — scope TBD. | 2026-07-15 |
| **Shared backend** | All booking logic, payments, data live in the existing BWA backend. App calls the same API. No duplication. | 2026-07-15 |
| **Next.js fate** | Stays forever for marketing/landing pages. App is fully Expo. | 2026-07-15 |
| **POS hardware** | Decide after apps are live in stores | 2026-07-15 |
| **Google Play account** | Individual — dhanani.farheen.46@gmail.com — $25 paid ✅ | 2026-07-15 |
| **Apple Developer account** | Buy at Step 21 only. Not needed until iOS submission. | 2026-07-15 |

---

## ⚠️ KNOWN GAPS — REVISIT LATER

| Field | Status | Notes |
|-------|--------|-------|
| `logo_url` | ❌ Not in `agency_clients` | Need to add this column to the DB, or store logo elsewhere (e.g. Storage bucket). Required for salon landing screen branding. |
| `address` | ❌ Not in `agency_clients` | Need to add this column. Required for Maps integration on confirmation screen. |
| `zip` | ❌ Not in `agency_clients` | Goes with address above. |
| `phone` | ⚠️ Exists as `owner_phone` | App currently uses `owner_phone`. Decide if a separate public-facing phone field is needed. |
| **Booking creation (no auth)** | ✅ Done — 2026-07-16 | Built `/api/mobile/bookings` — verifies payment via `payment_intent_id` instead of requiring Supabase auth. Payment screen now uses it. |
| **Card scan on payment screen** | ❌ Not working | Stripe PaymentSheet card scanner not functioning. Investigate next session. |
| **Magic link / auth email sender name** | ⏸ DEFERRED — hold until post-launch | Supabase Auth emails (magic link, etc.) currently show default Supabase sender, not "Book With AI". Fix = enable Custom SMTP in Supabase Dashboard (Auth → SMTP Settings) using existing Resend credentials, Sender Name = "Book With AI". Deliberately holding off: Resend free tier is capped at 3,000 emails/month and email volume will drop once app push notifications replace some of that after Play Store approval. Revisit once app is live. |
| **Native module rebuild required** | ⚠️ Process note | Adding a native package (e.g. `expo-secure-store`, `expo-local-authentication`) to `package.json`/`app.json` is NOT enough — it requires `npx expo prebuild --clean` + a full `npx expo run:android` rebuild before the JS can call it, or the app crashes on launch. This is what caused the 2026-07-16 launch crash. Also needs `JAVA_HOME` (Android Studio's bundled JDK) and `ANDROID_HOME`/`android/local.properties` set correctly in the shell running the build. |
| **Deep linking** | ⏸ Untestable in debug build | Will work automatically once app is live on Play Store. |
| **Stripe payment approach** | ✅ Switched to destination charges | Direct charges on connected account caused PaymentSheet issues. Now uses `transfer_data.destination` on platform account. Works. |
| **App icon** | `public/icons/icon-512.png` from booking-app — purple + gold atom on dark | 2026-07-15 |
| **Play Store feature graphic** | `public/feature-graphic-1024x500.png` from booking-app | 2026-07-15 |

---

## DESIGN SYSTEM

### Color Palette

| Element | Hex |
|---------|-----|
| Primary Purple | `#5B2EFF` |
| Primary Dark (buttons/hover) | `#4720D8` |
| Light Lavender Background | `#F7F3FF` |
| Pure White | `#FFFFFF` |
| Gold Accent | `#D4AF37` |
| Soft Gold | `#E7C96A` |
| Charcoal Text | `#222222` |
| Secondary Text | `#666666` |
| Light Border | `#E8E3F5` |
| Card Shadow | `rgba(34,34,34,0.08)` |

### Gradients
- **Primary:** `#6A3DFF` → `#5B2EFF`
- **Luxury:** `#FFFFFF` → `#F7F3FF`
- **Gold** *(use sparingly — premium badges, loyalty, gift cards)*: `#E7C96A` → `#D4AF37`

### Buttons
| Type | Background | Text | Border |
|------|-----------|------|--------|
| Primary | `#5B2EFF` | `#FFFFFF` | — |
| Secondary | `#FFFFFF` | `#5B2EFF` | `#5B2EFF` |
| Disabled | `#ECECEC` | `#999999` | — |

### Status Colors
| | Hex |
|--|-----|
| Success | `#22C55E` |
| Warning | `#F59E0B` |
| Error | `#EF4444` |
| Info | `#3B82F6` |

### Design Rules
- Border radius: **16px** for cards, **14–16px** for buttons
- Shadow: `0 4px 20px rgba(34,34,34,0.08)` — soft only, never heavy
- Plenty of whitespace
- Icons: purple on white
- Avoid heavy gradients — hero sections only

### Typography
- **Body / UI / labels / buttons:** Sora (400, 500, 600, 700)
- **Display headings / premium moments:** Fraunces (400, 400 Italic, 600, 700)

---

## FILE STRUCTURE

```
bookwithai-expo/
├── constants/
│   ├── Colors.ts       — full color palette
│   ├── Typography.ts   — font families + size scale
│   ├── Spacing.ts      — spacing + border radius + layout
│   ├── Shadows.ts      — iOS/Android shadow presets
│   └── Theme.ts        — single import for all tokens
│
└── src/
    └── app/
        ├── _layout.tsx              — Root Stack + font loading + splash
        ├── index.tsx                — Redirects to /book
        ├── explore.tsx              — Redirects to /book (scaffold remnant)
        ├── (tabs)/
        │   ├── _layout.tsx          — Bottom tab navigator (3 tabs)
        │   ├── book.tsx             — Book tab (QR + salon entry) [PLACEHOLDER]
        │   ├── my-booking.tsx       — My Booking tab [PLACEHOLDER]
        │   └── account.tsx          — Account tab [PLACEHOLDER]
        ├── salon/
        │   └── [id].tsx             — Salon landing screen [PLACEHOLDER]
        ├── booking/
        │   ├── services.tsx         — Service selection [PLACEHOLDER]
        │   ├── staff.tsx            — Staff selection [PLACEHOLDER]
        │   ├── datetime.tsx         — Date + time selection [PLACEHOLDER]
        │   ├── review.tsx           — Appointment review [PLACEHOLDER]
        │   ├── payment.tsx          — Payment [PLACEHOLDER]
        │   └── confirmation.tsx     — Booking confirmation [PLACEHOLDER]
        └── legal/
            ├── privacy.tsx          — Privacy policy [PLACEHOLDER]
            ├── terms.tsx            — Terms of service [PLACEHOLDER]
            ├── support.tsx          — Support [PLACEHOLDER]
            └── delete-account.tsx   — Data deletion request [PLACEHOLDER]
```

---

## PACKAGES INSTALLED

| Package | Purpose | Added |
|---------|---------|-------|
| `expo` SDK 57 | Core framework | 2026-07-15 |
| `expo-router` | File-based navigation | 2026-07-15 |
| `@expo-google-fonts/sora` | Sora font | 2026-07-15 |
| `@expo-google-fonts/fraunces` | Fraunces font | 2026-07-15 |
| `expo-font` | Font loading | 2026-07-15 |
| `expo-splash-screen` | Splash screen control | 2026-07-15 |
| `expo-status-bar` | Status bar styling | 2026-07-15 |
| `react-native-safe-area-context` | Safe area insets | 2026-07-15 |
| `@expo/vector-icons` | Ionicons for tab icons | 2026-07-15 |
| `@react-native-async-storage/async-storage` | Persist onboarding state + session data | 2026-07-15 |
| `@supabase/supabase-js` | Supabase client — same project as booking-app | 2026-07-15 |
| `expo-linking` | Deep link handling | 2026-07-15 |
| `expo-constants` | App config access | 2026-07-15 |
| `expo-camera` | QR code scanning | 2026-07-15 |
| `@stripe/stripe-react-native` | PaymentSheet + Google Pay | 2026-07-15 |
| `expo-calendar` | Add booking to device calendar | 2026-07-15 |
| `expo-haptics` | Haptic feedback on key actions | 2026-07-15 |

*Packages to install at later steps are listed in each step's notes below.*

---

## UPCOMING STEPS — NOTES

### Step 4 — Splash + Onboarding
- Branded splash screen with Book With AI logo on lavender background
- 3–4 onboarding slides (value props for customers)
- "Get Started" button leads to Book tab
- Packages needed: `expo-splash-screen` (already installed)

### Step 5 — Phone OTP Auth
- Phone number entry + country code picker
- OTP verification (6-digit code)
- Supabase auth (`@supabase/supabase-js`, `@supabase/ssr`)
- Session persistence on device
- Rate limiting + resend cooldown UI
- Packages needed: `@supabase/supabase-js`, `expo-secure-store`

### Step 6 — Salon Landing Screen
- Load salon by ID from deep link / QR scan
- Display: name, logo, cover image, hours, address, phone, policies
- Packages needed: none new

### Step 7 — QR Code Scanner
- Camera permission flow with explanation before asking
- Scan → extract salon ID → navigate to Salon Landing
- Packages needed: `expo-camera`, `expo-barcode-scanner`

### Step 8 — Service Selection
- Categories + individual services
- Name, price, duration, description, image
- Multi-select, running total
- No new packages expected

### Step 9 — Staff Selection
- Staff list filtered by selected services
- Photo, name, title, specialty, bio
- "Any available professional" option
- No new packages expected

### Step 10 — Date + Time Selection
- Calendar component with available / unavailable dates
- Time slot grid with real-time availability from API
- Timezone handling
- Slot hold countdown (3 min)
- Packages needed: `date-fns`, `date-fns-tz`

### Step 11 — Appointment Review
- Full summary of everything selected
- Price breakdown, policy display, consent checkbox
- No new packages expected

### Step 12 — Payment
- Stripe React Native integration
- Credit/debit card form
- Google Pay
- Deposit vs full payment logic
- Packages needed: `@stripe/stripe-react-native`

### Step 13 — Booking Confirmation
- Confirmation number, receipt, salon details
- Add to calendar, share, directions buttons
- Packages needed: `expo-calendar`, `expo-sharing`

### Step 14 — Deep Linking
- Universal Links (iOS) + App Links (Android)
- Salon / service / staff / appointment specific links
- Packages needed: `expo-linking`

### Step 15 — Calendar + Maps
- Add to device calendar
- Open Apple Maps / Google Maps / preferred nav app
- Packages needed: `expo-calendar`, `expo-location` (only on tap)

### Step 16 — Legal Screens
- Privacy policy, Terms of service, Support, Data deletion
- Required by both Apple and Google for store approval
- No new packages expected

### Step 17 — Error Handling Pass
- All error states wired up across every screen
- No internet, timeout, payment failure, booking conflict, session expired

### Step 18 — Native Polish
- Haptic feedback, status bar, safe areas, keyboard handling
- Android back button, skeleton loaders, transitions
- Packages needed: `expo-haptics`

### Step 19 — Internal Testing
- Full end-to-end flow on real Android device
- Bug fixes only — no new features

### Step 20 — Android Build + Google Play
- Generate AAB (Android App Bundle)
- Play Store listing: screenshots, description, feature graphic
- Submit and await review (1–3 days typically)

### Step 21 — iOS Build + App Store
- Buy Apple Developer account ($99/year) at this point
- Expo EAS cloud build (no Mac needed)
- TestFlight internal testing
- App Store listing + submission
- Review typically 1–7 days
