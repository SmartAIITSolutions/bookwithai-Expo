import AsyncStorage from '@react-native-async-storage/async-storage';

// i18n foundation (L1) — the explicit, user-chosen app-UI-language
// preference. Local-only for V1 (Locked Product Decision §4): AsyncStorage,
// never SecureStore (language is not sensitive data), no database column,
// no cross-device sync yet. Mirrors the exact module-level-KEY +
// async-getX/setX pattern already used elsewhere in this app (see
// src/lib/calendar/daySampleMode.ts, src/lib/api/ownerSanaa.ts's dev-state
// override, and _layout.tsx's ONBOARDING_KEY) rather than inventing a new
// persistence shape.
const LANGUAGE_PREFERENCE_KEY = 'bwa_language_preference';

/** null means "no explicit choice yet" -- callers fall through to device
 *  locale detection, then English (see resolveLocale.ts). */
export async function getLanguagePreference(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  } catch {
    return null;
  }
}

export async function setLanguagePreference(code: string | null): Promise<void> {
  try {
    if (code) await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, code);
    else await AsyncStorage.removeItem(LANGUAGE_PREFERENCE_KEY);
  } catch {
    // Best-effort -- a failed write only means the in-memory i18next
    // language change (already applied by the caller before this runs)
    // won't survive an app restart. Never block the runtime switch on it.
  }
}

// L10 (PA1 Section F fix) — distinguishes a preference the user actually
// picked from one merely *adopted* from another signed-in account's server
// preference during reconcileServerLanguagePreference(). Without this, a
// server-adopted language gets persisted to AsyncStorage indistinguishably
// from a real pick, so on a shared device a second account signing in with
// no preference of its own would inherit account A's language AND push it
// back up as if it were account B's own explicit choice. See
// AuthContext.tsx's signOut(), which clears the preference on sign-out only
// when its source is 'server-adopted' -- a real user pick is never cleared.
const LANGUAGE_PREFERENCE_SOURCE_KEY = 'bwa_language_preference_source';
export type LanguagePreferenceSource = 'explicit' | 'server-adopted';

export async function getLanguagePreferenceSource(): Promise<LanguagePreferenceSource | null> {
  try {
    const v = await AsyncStorage.getItem(LANGUAGE_PREFERENCE_SOURCE_KEY);
    return v === 'explicit' || v === 'server-adopted' ? v : null;
  } catch {
    return null;
  }
}

export async function setLanguagePreferenceSource(source: LanguagePreferenceSource | null): Promise<void> {
  try {
    if (source) await AsyncStorage.setItem(LANGUAGE_PREFERENCE_SOURCE_KEY, source);
    else await AsyncStorage.removeItem(LANGUAGE_PREFERENCE_SOURCE_KEY);
  } catch {
    // Best-effort, same reasoning as setLanguagePreference().
  }
}
