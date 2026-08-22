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
