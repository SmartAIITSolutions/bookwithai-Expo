import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { resources, NAMESPACES } from './resources';
import { FALLBACK_LANGUAGE, SUPPORTED_LANGUAGE_CODES } from './languages';
import { getLanguagePreference, setLanguagePreference, setLanguagePreferenceSource, type LanguagePreferenceSource } from './storage';
import { resolveLanguage } from './resolveLocale';

let initPromise: Promise<void> | null = null;

/**
 * i18n foundation (L1) — call once from the app root and await it before
 * rendering anything that reads a translation (mirrors the existing
 * `fontsLoaded` gate in `_layout.tsx`), so there is no flash of the wrong
 * language on cold start. Resolves the initial language BEFORE i18next.init
 * ever runs (explicit preference -> device locale -> English, per Locked
 * Product Decision §4), rather than initializing in English and switching
 * after -- that ordering is what avoids the flicker.
 *
 * Idempotent: safe to call more than once (e.g. Fast Refresh in dev) --
 * every call after the first returns the same in-flight/resolved promise.
 */
export function initI18n(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const explicitPreference = await getLanguagePreference();
    const deviceLocaleTags = Localization.getLocales().map(l => l.languageTag);
    const language = resolveLanguage({
      explicitPreference,
      deviceLocaleTags,
      supportedCodes: SUPPORTED_LANGUAGE_CODES,
      fallback: FALLBACK_LANGUAGE,
    });

    await i18next.use(initReactI18next).init({
      resources,
      lng: language,
      fallbackLng: FALLBACK_LANGUAGE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      // React already escapes interpolated values -- i18next's own HTML
      // escaping would double-escape them.
      interpolation: { escapeValue: false },
      compatibilityJSON: 'v4',
      returnEmptyString: false,
      // Production-safe fallback (§H): a missing key still resolves through
      // i18next's own fallbackLng chain to the English string first; this
      // handler only adds a loud __DEV__ console warning so a missing
      // Spanish key is actually noticed during development, without ever
      // throwing or blocking a normal render.
      saveMissing: __DEV__,
      missingKeyHandler: __DEV__
        ? (langs, ns, key) => console.warn(`[i18n] Missing translation key: "${ns}:${key}" for language(s):`, langs)
        : undefined,
    });
  })();

  return initPromise;
}

/** Runtime language switch (Locked Product Decision §A/§F) -- changes the
 *  active i18next language immediately (no reload needed) and persists the
 *  preference so it wins over device locale on next launch.
 *
 *  `source` defaults to 'explicit' (a real user pick via the language
 *  picker). reconcileServerLanguagePreference() passes 'server-adopted'
 *  when it adopts another signed-in session's persisted server preference
 *  -- see storage.ts's LanguagePreferenceSource doc comment for why this
 *  distinction exists (PA1 Section F: prevents a leaked/pushed-back
 *  preference across an account switch on a shared device). */
export async function changeLanguage(code: string, source: LanguagePreferenceSource = 'explicit'): Promise<void> {
  await i18next.changeLanguage(code);
  await setLanguagePreference(code);
  await setLanguagePreferenceSource(source);
}

export default i18next;
