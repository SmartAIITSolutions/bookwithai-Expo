@AGENTS.md

# Multilingual / i18n

Book With AI is multilingual by architecture (i18next + react-i18next + expo-localization, foundation established in the L1 checkpoint). All new customer-facing and salon-owner-facing UI copy must use the centralized i18n system (`useTranslation()`'s `t()`, keys under `src/locales/<lang>/*.json`) — no new hard-coded user-facing strings in components. Every new translation key must include translations for all currently required languages (`en`, `es`) in the same change; do not wait to be reminded to add Spanish. Run `npm run validate-translations` and `npm run check-hardcoded-strings` before considering i18n-related work done.
