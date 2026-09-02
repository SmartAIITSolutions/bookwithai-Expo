// i18n foundation (L1) — the single, central registry of every language the
// app knows about. Feature code must NEVER hardcode 'en'/'es' string
// literals or `if (language === 'es')` branches (Locked Product Decision
// §B) -- read from here instead, so adding a future language (French,
// Portuguese, Hindi, Arabic, or a regional locale like es-MX/pt-BR) is
// primarily a registry entry + resource files + validation + enablement,
// not a feature-screen rewrite.

export type LanguageDirection = 'ltr' | 'rtl';

export interface LanguageDefinition {
  /** App-internal language code (base BCP-47 subtag today, e.g. 'en', 'es'). */
  code: string;
  /** The language's own name for itself, e.g. 'Español'. */
  nativeName: string;
  /** English name, for admin/dev-facing surfaces (e.g. a QA language switcher). */
  englishName: string;
  direction: LanguageDirection;
  /**
   * Whether this language should be offered in a real, production
   * language picker today. False does NOT mean "no resources exist" --
   * Spanish has real resources from L1 onward, but most screens aren't
   * migrated yet (L2-L7), so it must not be advertised as if the whole
   * app were translated (Locked Product Decision §5). __DEV__ builds
   * ignore this flag entirely -- see getSelectableLanguages().
   */
  selectable: boolean;
}

export const LANGUAGES: readonly LanguageDefinition[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', direction: 'ltr', selectable: true },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', direction: 'ltr', selectable: true },
] as const;

export const FALLBACK_LANGUAGE = 'en';

export const SUPPORTED_LANGUAGE_CODES: readonly string[] = LANGUAGES.map(l => l.code);

export function getLanguage(code: string): LanguageDefinition | undefined {
  return LANGUAGES.find(l => l.code === code);
}

export function isSupportedLanguageCode(code: string): boolean {
  return SUPPORTED_LANGUAGE_CODES.includes(code);
}

/**
 * Languages safe to show in a real, user-facing language picker right now.
 * Production sees only languages explicitly marked `selectable: true`
 * (today: English only -- Spanish activates once L2-L7 migration and QA
 * are done, per Locked Product Decision §5). __DEV__ builds see every
 * loaded language regardless, so Spanish can be exercised for development
 * and QA before public activation.
 */
export function getSelectableLanguages(): LanguageDefinition[] {
  if (__DEV__) return [...LANGUAGES];
  return LANGUAGES.filter(l => l.selectable);
}
