import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

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
      // default on a transient failure -- leave state as-is. The next auth
      // event (or a manual refreshProfile()) will correct it once the
      // underlying glitch clears.
      return;
    }

    if (!data) {
      // Query genuinely succeeded with zero rows even after the retry --
      // this can legitimately happen in the split second before a brand-new
      // signup's profiles-creation trigger commits. 'customer' is the
      // correct default only in this confirmed case.
      setRole('customer');
      setClientId(null);
      return;
    }

    setRole(data.role as UserRole);
    setClientId(data.client_id ?? null);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // `loading` may already be false from a previous settled auth state --
      // reset it here so consumers (AuthRedirectGate) don't act on a stale
      // `role` while this event's loadProfile() is still in flight. This was
      // the real root cause of the owner-routing-to-customer-tabs bug: a
      // slow profile fetch left a multi-second window where loading=false
      // but role hadn't been refreshed yet.
      setLoading(true);
      try {
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
