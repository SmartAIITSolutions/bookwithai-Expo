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
| 19 — Internal Testing | 1–2 sessions | ⬜ Up next | — |
| 20 — Android / Google Play | 3–7 days (Google review) | ⬜ | Review wait time unchanged |
| 21 — iOS / App Store | 1–7 days (Apple review) | ⬜ | Review wait time unchanged |

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
| 19 | Internal Testing | 🔄 In progress | 2026-07-15 |
| 20 | Android Build + Google Play | ⬜ | |
| 21 | iOS Build (EAS) + App Store | ⬜ | |

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
