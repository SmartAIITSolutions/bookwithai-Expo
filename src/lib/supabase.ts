import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { secureSessionStorage } from './secureSessionStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// P12.7 — session material (access/refresh tokens) is no longer persisted
// in plain AsyncStorage. secureSessionStorage encrypts it (AES-256-CTR)
// with the key held in SecureStore (iOS Keychain / Android Keystore),
// migrating any existing plaintext session on first read. See
// secureSessionStorage.ts for the full reasoning and Supabase's own
// documented pattern this follows.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase's own React Native guidance: without this, autoRefreshToken's
// timer isn't reliably kept alive across background/foreground cycles, so a
// session that's been idle for a while can still be sitting on a stale
// token when the app resumes -- meaning the *next* authenticated request
// (e.g. a drag-to-reschedule save) is the one that ends up surfacing an
// overdue, more failure-prone refresh instead of it happening proactively
// in the background. This was a real gap: confirmed via full codebase
// search that nothing wired AppState to start/stopAutoRefresh before now.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Supabase's default persisted-session key (supabase-js derives it as
// `sb-<first hostname label>-auth-token` when no `storageKey` option is set,
// which is the case above). Parsed with a regex rather than
// `new URL().hostname` so this can never throw at module load on a React
// Native URL implementation without `hostname`.
function sessionStorageKey(): string | null {
  const host = supabaseUrl?.match(/^[a-z]+:\/\/([^/:?#]+)/i)?.[1];
  return host ? `sb-${host.split('.')[0]}-auth-token` : null;
}

// Local-only, read-only peek at the persisted session's user id -- no
// network, no token refresh, no writes. Lets the cold-start splash know who
// is signed in on this device without waiting for the client's own
// initialization, which blocks on refreshing an expired access token.
// Returns null for anything unexpected (no session, no refresh token,
// unreadable/changed format) so callers fall back to the client's
// INITIAL_SESSION instead of guessing.
export async function peekStoredSessionUserId(): Promise<string | null> {
  try {
    const key = sessionStorageKey();
    if (!key) return null;
    const raw = await secureSessionStorage.peekItem(key);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { refresh_token?: unknown; user?: { id?: unknown } } | null;
    if (!stored || typeof stored.refresh_token !== 'string' || !stored.refresh_token) return null;
    const userId = stored.user?.id;
    return typeof userId === 'string' && userId ? userId : null;
  } catch {
    return null;
  }
}
