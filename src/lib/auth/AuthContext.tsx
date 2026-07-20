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
    console.log('[DIAG] loadProfile: start', { userId });
    latestProfileRequest.current = userId;
    const { data, error } = await supabase
      .from('profiles')
      .select('role, client_id')
      .eq('id', userId)
      .maybeSingle();

    console.log('[DIAG] loadProfile: query result', { userId, data, error: error?.message });

    if (latestProfileRequest.current !== userId) {
      console.log('[DIAG] loadProfile: superseded, dropping result', { userId, latest: latestProfileRequest.current });
      return; // superseded by a newer request
    }

    if (error) {
      console.error('AuthContext: failed to load profile role', error);
    }
    const resolvedRole = (data?.role as UserRole) ?? 'customer';
    console.log('[DIAG] loadProfile: setting role', { userId, resolvedRole, clientId: data?.client_id ?? null });
    setRole(resolvedRole);
    setClientId(data?.client_id ?? null);
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[DIAG] getSession (initial): result', { hasSession: !!session, userId: session?.user?.id });
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
      console.log('[DIAG] getSession (initial): setLoading(false) called');
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[DIAG] onAuthStateChange fired', { event: _event, hasSession: !!session, userId: session?.user?.id });
      // `loading` may already be false from a previous settled auth state --
      // reset it here so consumers (AuthRedirectGate) don't act on a stale
      // `role` while this event's loadProfile() is still in flight. This was
      // the real root cause of the owner-routing-to-customer-tabs bug: a
      // slow profile fetch left a multi-second window where loading=false
      // but role hadn't been refreshed yet.
      setLoading(true);
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        latestProfileRequest.current = null;
        setRole(null);
        setClientId(null);
      }
      setLoading(false);
      console.log('[DIAG] onAuthStateChange: setLoading(false) called', { event: _event });
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
