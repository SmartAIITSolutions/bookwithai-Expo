import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
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
