import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage as changeLanguageInternal } from './index';
import { FALLBACK_LANGUAGE, getLanguage, getSelectableLanguages, type LanguageDefinition, type LanguageDirection } from './languages';

export interface UseLanguageResult {
  languageCode: string;
  language: LanguageDefinition;
  direction: LanguageDirection;
  /** Every language safe to offer in a real picker right now -- see
   *  getSelectableLanguages() for the production-vs-__DEV__ rule. */
  languages: LanguageDefinition[];
  changeLanguage: (code: string) => Promise<void>;
}

/**
 * i18n foundation (L1) — the one interface feature screens should use for
 * anything language-related beyond translating strings (which is
 * `useTranslation()`'s own `t()`, used directly). Deliberately does not
 * expose i18next internals -- screens shouldn't need to know this is
 * i18next under the hood, or how the preference is persisted.
 */
export function useLanguage(): UseLanguageResult {
  const { i18n } = useTranslation();
  const languageCode = i18n.language || FALLBACK_LANGUAGE;
  const language = getLanguage(languageCode) ?? getLanguage(FALLBACK_LANGUAGE)!;

  const changeLanguage = useCallback((code: string) => changeLanguageInternal(code), []);

  return {
    languageCode,
    language,
    direction: language.direction,
    languages: getSelectableLanguages(),
    changeLanguage,
  };
}
