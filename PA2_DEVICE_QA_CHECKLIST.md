# PA2 Device QA Checklist — run on a real physical iOS or Android device

Use the current internal/dev/TestFlight/Play-internal build. If your installed
build predates the L10 multilingual work, stop and let me know — you'll need a
fresh internal build before this checklist is meaningful.

For each item, just note: **PASS**, or a one-line description of what broke
(screen + what you saw). Screenshots are a bonus but not required. Report back
in whatever order is convenient — I'll slot the results into the right section
of the PA2 report.

---

## D. Owner language switching
1. Sign in as the QA owner (English).
2. Open the language selector (More screen).
3. Select Español — does the UI change immediately?
4. Force-close and reopen the app — does it stay in Spanish?
5. Switch back to English — does everything revert cleanly?

## E. Customer language switching
1. Sign in as the QA customer (English).
2. Switch to Español via Account.
3. Force-close and reopen — Spanish persists?
4. Sign out, sign back in — still Spanish?
5. Switch back to English.

## F. Shared-device leak test (the bug fixed in PA1)
1. On one device: sign into Account A, set/confirm Spanish.
2. Sign out.
3. Sign into Account B (a *different* account with no Spanish preference of its own).
4. Does B come up in English (not inherit A's Spanish)?
5. Sign out of B, back into A — is A still Spanish?

## G. Signed-out behavior
1. Sign out completely.
2. Is a language selector still usable (if shown)?
3. Does your last explicit choice still hold, or does it fall back to device language sensibly?

## H. Customer Spanish smoke test
With the app in Spanish, click through: Welcome/Auth → Account → Discover/Book →
Salon detail → Service selection → Staff selection → Date/time → Review →
Payment (test mode) → Confirmation → My Bookings → Appointment detail → Profile
→ Notifications → QR Scanner.
Flag: English leakage, raw keys like `common:xyz`, clipped/overlapping text,
broken navigation, wrong date/time.

## I. Owner Spanish smoke test
In Spanish: Dashboard, Calendar (Day/3-Day/Week/Month), Queue, Appointment
detail, Customers, Customer detail, Services, Staff, Business Settings,
Payments, Products, Packages, Membership Plans, Time Off, Clock, More.
Same flags as above, plus: any canonical value (business type, status, etc.)
showing translated text where it shouldn't.

## J. Calendar safety
In Spanish, open each calendar view. Confirm appointment positions/durations/
overlaps/current-time-indicator/dates look exactly as they would in English —
only the labels should differ. If safe, move one test appointment and confirm
the new time is what you'd expect (no hidden shift).

## K. Block Time
Open Block Time in Spanish on the QA business only. Confirm reason chips are
translated, but don't worry about what's stored — that was already verified
in the database. Confirm date/time picking still works normally.

## L. Checkout
Open a controlled/test checkout in Spanish. Confirm Subtotal/Discount/Tip/Tax/
Total labels are translated, but the actual numbers and currency are unchanged
from what English would show for the same items.

## M. SANAA separation
Open SANAA screens in Spanish (Discovery/Setup/Phone/Test/Plans/Billing/Calls/
Operations Home). Confirm the screen chrome is Spanish but nothing about SANAA
itself (voice, prompt, phone number, test-call behavior) changed.

## N. Staff persona
If you can sign in as staff: Account, Earnings, Schedule, Time Off — Spanish,
no clipping, no raw keys.

## V. Layout/text-expansion watch
Pay extra attention to: bottom tabs, calendar view selector, calendar cards,
dashboard KPIs, settings rows, checkout buttons, SANAA cards, notification
cards, QR Scanner, auth buttons, staff cards. Flag anything that clips,
overlaps, or wraps badly in Spanish. Rate each: BLOCKER / MINOR / COSMETIC.

## W. Raw key / English leak scan
Anywhere you see a literal dotted key (like `owner.dashboard.title`) instead
of real text, or app-owned English text that should have translated but
didn't — note the screen and the exact text/key.

Do NOT flag: business names, service/staff/customer names, notes, SANAA brand
name itself, or legal document body text (that's expected to stay as-is).
