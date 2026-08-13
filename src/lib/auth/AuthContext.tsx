import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const ROLE_CACHE_PREFIX = 'bwa_role_cache_';

async function cacheRole(userId: string, role: UserRole, clientId: string | null) {
  try {
    await AsyncStorage.setItem(`${ROLE_CACHE_PREFIX}${userId}`, JSON.stringify({ role, clientId }));
  } catch {
    // best-effort -- worst case the fallback below just isn't available next time
  }
}

export async function getCachedRole(userId: string): Promise<{ role: UserRole; clientId: string | null } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ROLE_CACHE_PREFIX}${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export type UserRole = 'customer' | 'owner' | 'staff';

interface AuthContextValue {
  user:     User | null;
  session:  Session | null;
  role:     UserRole | null;
  clientId: string | null;
  loading:  boolean;
  signOut:  (scope?: 'local' | 'global') => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:     null,
  session:  null,
  role:     null,
  clientId: null,
  loading:  true,
  signOut:  async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,     setUser]     = useState<User | null>(null);
  const [session,  setSession]  = useState<Session | null>(null);
  const [role,     setRole]     = useState<UserRole | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  // Guards against a stale/overlapping loadProfile call (e.g. from a sign-out
  // still in flight) resolving after a newer one and clobbering the correct
  // role -- only the most recently requested userId is allowed to write state.
  const latestProfileRequest = useRef<string | null>(null);

  async function loadProfile(userId: string) {
    latestProfileRequest.current = userId;

    const fetchProfile = () =>
      supabase.from('profiles').select('role, client_id').eq('id', userId).maybeSingle();

    let { data, error } = await fetchProfile();

    // A failed query or zero rows for an already-authenticated user is
    // almost always a transient RLS/token-refresh race, not a real "no
    // profile" case -- every auth.users row gets a profiles row via a DB
    // trigger at signup, and RLS silently returns zero rows (not an error)
    // when a query races a token refresh. This was the real cause of an
    // owner intermittently landing on customer tabs: the blind `?? 'customer'`
    // fallback below treated that empty read as if the account really had
    // no profile, silently downgrading a real owner to 'customer'. Retry
    // once after a short delay before trusting an empty/failed read.
    if (error || !data) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      ({ data, error } = await fetchProfile());
    }

    if (latestProfileRequest.current !== userId) {
      return; // superseded by a newer request
    }

    if (error) {
      console.error('AuthContext: failed to load profile role after retry', error);
      // Don't clobber a previously-known-good role/clientId with a guessed
      // default on a transient failure -- fall back to whatever this user's
      // last confirmed role was (persisted below on every successful read),
      // rather than leaving state null/stuck on a cold start where nothing
      // has loaded yet.
      const cached = await getCachedRole(userId);
      if (latestProfileRequest.current !== userId) return;
      if (cached) {
        setRole(cached.role);
        setClientId(cached.clientId);
      }
      return;
    }

    if (!data) {
      // Query genuinely succeeded with zero rows even after the retry. This
      // is the exact race that intermittently routed a real salon owner
      // into customer tabs: a single 400ms retry isn't always enough to
      // outlast a token-refresh/RLS race on a real device/network, and
      // blindly defaulting to 'customer' here punishes a returning user for
      // a transient glitch. Only trust this as "genuinely no profile yet"
      // when there's no cached role for this user (the real brand-new-
      // signup case, before the profiles-creation trigger commits) --
      // otherwise keep showing their last confirmed role.
      const cached = await getCachedRole(userId);
      if (latestProfileRequest.current !== userId) return;
      if (cached) {
        setRole(cached.role);
        setClientId(cached.clientId);
      } else {
        setRole('customer');
        setClientId(null);
      }
      return;
    }

    setRole(data.role as UserRole);
    setClientId(data.client_id ?? null);
    cacheRole(userId, data.role as UserRole, data.client_id ?? null);
  }

  useEffect(() => {
    // Get initial session. Wrapped in try/catch/finally -- this gates the
    // app's entire initial `loading` state, so if getSession() or
    // loadProfile() ever throws (a real network failure, not just a
    // Supabase-shaped {error} response), the whole app would otherwise be
    // stuck on `loading: true` forever with nothing able to render.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) await loadProfile(session.user.id);
      } catch (error) {
        console.error('AuthContext: initial getSession failed', error);
      } finally {
        setLoading(false);
      }
    })();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // `loading` may already be false from a previous settled auth state --
      // reset it here so consumers (AuthRedirectGate) don't act on a stale
      // `role` while this event's loadProfile() is still in flight. This was
      // the real root cause of the owner-routing-to-customer-tabs bug: a
      // slow profile fetch left a multi-second window where loading=false
      // but role hadn't been refreshed yet.
      setLoading(true);
      try {
        // A `SIGNED_OUT`/null-session event with a previously-signed-in user
        // still on record is treated as suspect, not final. On React Native,
        // a background/foreground cycle with an overdue token refresh (the
        // exact gap plugged in supabase.ts) can surface as a transient
        // SIGNED_OUT before the SDK settles, and blindly trusting it here
        // wiped `role`, which is the second half of the owner-routing bug:
        // `_layout.tsx` sees `role === null` and defaults to customer tabs
        // for the rest of that render. Re-check getSession() once before
        // accepting the sign-out as real.
        if (!session && event !== 'INITIAL_SESSION' && latestProfileRequest.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          const { data: recheck } = await supabase.auth.getSession();
          session = recheck.session;
        }

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          latestProfileRequest.current = null;
          setRole(null);
          setClientId(null);
        }
      } catch (error) {
        console.error('AuthContext: onAuthStateChange handler failed', error);
      } finally {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut(scope: 'local' | 'global' = 'local') {
    await supabase.auth.signOut({ scope });
  }

  // Re-reads profiles.role/client_id for the current session without a
  // full sign-out/sign-in -- needed right after linking a staff invite,
  // since that write happens server-side and onAuthStateChange only
  // fires on an actual token change, not a profiles row update.
  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ user, session, role, clientId, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
