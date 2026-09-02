// i18n foundation (L1) — pure, framework-agnostic locale resolution.
// Deliberately has zero AsyncStorage/expo-localization calls inside it (the
// actual I/O lives in storage.ts and the expo-localization call in
// index.ts) so this one function is directly unit-testable and is the
// single place the Locked Product Decision §4 priority order is expressed.

export interface ResolveLanguageInput {
  /** The explicit, locally saved preference, or null if none was ever set. */
  explicitPreference: string | null;
  /** Device locale tags in the OS's own priority order, e.g. ['es-MX', 'en-US']. */
  deviceLocaleTags: string[];
  supportedCodes: readonly string[];
  fallback: string;
}

/**
 * Locked resolution priority (Product Decision §4):
 *   A. explicit locally saved app-language preference
 *   B. supported device language
 *   C. English fallback
 */
export function resolveLanguage(input: ResolveLanguageInput): string {
  const { explicitPreference, deviceLocaleTags, supportedCodes, fallback } = input;

  if (explicitPreference && supportedCodes.includes(explicitPreference)) {
    return explicitPreference;
  }

  for (const tag of deviceLocaleTags) {
    const base = baseLanguageCode(tag);
    if (base && supportedCodes.includes(base)) return base;
  }

  return fallback;
}

/**
 * 'es-MX' -> 'es', 'en' -> 'en', '' / malformed -> null. Deliberately
 * matches only the base language subtag today -- every regional variant of
 * a supported language resolves to that language's shared resources for
 * now. This is the one seam a future regional-locale rollout (en-GB,
 * es-MX, es-ES, pt-BR, etc., per the architecture's own future-locale
 * requirement) would extend to prefer a region-specific resource set when
 * one exists, rather than something that needs rewriting.
 */
function baseLanguageCode(tag: string): string | null {
  const base = tag?.split('-')[0]?.toLowerCase();
  return base && base.length > 0 ? base : null;
}
