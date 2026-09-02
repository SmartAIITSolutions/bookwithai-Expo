import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLanguage } from '@/lib/i18n/useLanguage';
import { useAuth } from '@/lib/auth/AuthContext';
import { setServerLanguagePreference } from '@/lib/i18n/serverPreference';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface LanguagePickerRowProps {
  /** 'light' (default) matches the customer/staff light theme (Colors.*).
   *  'dark' matches the owner app's dark/gold glass theme, which doesn't
   *  use the Colors module at all -- see owner-settings/*.tsx for the
   *  same literal-hex convention this mirrors. */
  variant?: 'light' | 'dark';
}

// L10 — the one reusable language-picker UI, shared across customer/owner/
// staff account screens (Section G: registry-driven, never an `if
// (language === 'es')` per-screen special case). Only ever shows languages
// `getSelectableLanguages()` returns -- production sees English-only until
// Spanish's `selectable` flag flips true; __DEV__ sees every loaded
// language for review/QA regardless (see languages.ts).
//
// Signed-out users: changeLanguage() still works (persists locally via
// AsyncStorage, same as before this component existed) -- the server-push
// below is skipped when there's no `role` to attribute the preference to,
// matching Section F's "don't require auth merely to choose language."
export function LanguagePickerRow({ variant = 'light' }: LanguagePickerRowProps) {
  const { languageCode, languages, changeLanguage } = useLanguage();
  const { role } = useAuth();
  const dark = variant === 'dark';

  async function handleSelect(code: string) {
    if (code === languageCode) return;
    await changeLanguage(code);
    if (role) {
      // Best-effort, fire-and-forget -- the local switch above already
      // took effect regardless of whether this succeeds.
      setServerLanguagePreference(role, code);
    }
  }

  return (
    <View style={styles.row}>
      {languages.map((lang) => {
        const active = lang.code === languageCode;
        return (
          <Pressable
            key={lang.code}
            style={[
              styles.chip,
              dark ? styles.chipDark : styles.chipLight,
              active && (dark ? styles.chipActiveDark : styles.chipActiveLight),
            ]}
            onPress={() => handleSelect(lang.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[
              styles.chipText,
              dark ? styles.chipTextDark : styles.chipTextLight,
              active && (dark ? styles.chipTextActiveDark : styles.chipTextActiveLight),
            ]}>{lang.nativeName}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
  chipLight: { backgroundColor: Colors.card, borderColor: Colors.border },
  chipActiveLight: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipDark: { backgroundColor: 'rgba(0,0,0,0.2)', borderColor: 'rgba(212,175,55,0.35)' },
  chipActiveDark: { backgroundColor: 'rgba(212,175,55,0.9)', borderColor: '#F4D77A' },
  chipText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm },
  chipTextLight: { color: Colors.textPrimary },
  chipTextActiveLight: { color: Colors.white },
  chipTextDark: { color: 'rgba(255,255,255,0.65)' },
  chipTextActiveDark: { color: '#09000F' },
});
