# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Multilingual / i18n

Book With AI is multilingual by architecture — one set of screens/components/business logic, multiple languages through a centralized i18n system (i18next + react-i18next + expo-localization; see `src/lib/i18n/`). English (`en`) is canonical/source; Spanish (`es`) is currently required alongside it. The architecture supports adding more languages later without duplicating screens or logic — never hardcode `'en'`/`'es'` literals or `if (language === 'es')` branches in feature code; use `src/lib/i18n/languages.ts`'s registry instead.

Rules for all new customer-facing and salon-owner-facing UI copy:
- No new hard-coded user-facing strings in components (`<Text>literal</Text>`, `placeholder="..."`, `title="..."`, `accessibilityLabel="..."`, `Alert.alert(...)`, etc.). Use `useTranslation()`'s `t('namespace.key')` instead.
- Every new translation key must be added to every currently-required language's resource file (`src/locales/en/<namespace>.json` and `src/locales/es/<namespace>.json`) in the same change — never add an English key without its Spanish counterpart. Do not wait to be told "also make this Spanish."
- Never machine-translate or auto-localize user-generated/business content (salon names, customer/staff names, service names/descriptions entered by a salon, policies, FAQs, notes, SANAA call summaries/transcripts) — only application-owned UI copy goes through the translation system. App-generated fallback literals (e.g. "Customer", "Service") ARE translatable UI copy.
- Do not translate `Book With AI` or `SANAA` (brand terms) in any language.
- Before considering i18n-related work done, run `npm run validate-translations` (fails on missing/orphan keys or interpolation-variable mismatches between languages) and `npm run check-hardcoded-strings` (fails on newly introduced hard-coded strings not already in the tracked baseline).
- Existing untranslated screens are known technical debt being migrated incrementally (L2-L7) — this rule governs NEW code, not a mandate to retrofit unrelated existing screens as a side effect of another task.
