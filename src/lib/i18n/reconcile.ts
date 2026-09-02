import { getLanguagePreference } from './storage';
import { fetchServerLanguagePreference, setServerLanguagePreference } from './serverPreference';
import { changeLanguage } from './index';
import { isSupportedLanguageCode } from './languages';
import type { UserRole } from '@/lib/auth/AuthContext';

// L10 — reconciles the local explicit preference (AsyncStorage,
// storage.ts) with the persisted server preference, once per
// authenticated session. Deliberately NOT called from initI18n() (index.ts)
// -- that function must stay synchronous-ish and network-free so cold
// start has no flash of the wrong language (see its own comment); this
// runs afterward, once auth actually resolves, and never blocks first
// paint.
//
// Precedence (locked):
//   1. explicit local choice, if one was intentionally made on this device
//      -- wins, and is pushed to the server so other devices/backend
//      recipient-locale resolution pick it up too.
//   2. otherwise, the server's persisted preference, if one exists --
//      adopted locally (via changeLanguage(), which also persists it
//      locally as an explicit choice from that point on).
//   3. otherwise, nothing to reconcile -- the device-locale-resolved
//      language from initI18n() stays in effect, exactly as before this
//      existed.
//
// `getLanguagePreference()` returning non-null IS the "was this explicit"
// signal (see storage.ts's own doc comment) -- no separate flag needed.
export async function reconcileServerLanguagePreference(role: UserRole): Promise<void> {
  const localExplicit = await getLanguagePreference();

  if (localExplicit && isSupportedLanguageCode(localExplicit)) {
    // Local explicit choice wins -- push it server-side (best-effort,
    // fire-and-forget; never blocks or throws into the caller).
    setServerLanguagePreference(role, localExplicit);
    return;
  }

  const serverPreference = await fetchServerLanguagePreference(role);
  if (serverPreference && isSupportedLanguageCode(serverPreference)) {
    // 'server-adopted', not the default 'explicit' -- this device didn't
    // actually choose this language, it inherited it from the signed-in
    // account's server preference. Marking it this way lets signOut()
    // clear it again so a different account signing in next doesn't
    // inherit it or push it back up as if it were their own choice.
    await changeLanguage(serverPreference, 'server-adopted');
  }
  // Neither local nor server has an explicit preference -- leave the
  // device-locale-resolved language from initI18n() untouched.
}
