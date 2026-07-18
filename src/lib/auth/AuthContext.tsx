import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export type UserRole = 'customer' | 'owner';

interface AuthContextValue {
  user:     User | null;
  session:  Session | null;
  role:     UserRole | null;
  clientId: string | null;
  loading:  boolean;
  signOut:  (scope?: 'local' | 'global') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user:     null,
  session:  null,
  role:     null,
  clientId: null,
  loading:  true,
  signOut:  async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,     setUser]     = useState<User | null>(null);
  const [session,  setSession]  = useState<Session | null>(null);
  const [role,     setRole]     = useState<UserRole | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('role, client_id')
      .eq('id', userId)
      .maybeSingle();
    setRole((data?.role as UserRole) ?? 'customer');
    setClientId(data?.client_id ?? null);
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) await loadProfile(session.user.id);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setRole(null);
        setClientId(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut(scope: 'local' | 'global' = 'local') {
    await supabase.auth.signOut({ scope });
  }

  return (
    <AuthContext.Provider value={{ user, session, role, clientId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
