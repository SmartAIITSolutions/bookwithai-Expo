import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// P8.6: live-refresh signal for Operations Home (Results + Recent Activity)
// and the Calls screen, whenever this salon's sanaa_call_logs rows change.
// Mirrors useOwnerBookings.ts's Realtime pattern exactly (per-mount channel
// nonce, postgres_changes filtered to this client_id) -- but sanaa_call_logs
// previously had a `USING (true)` SELECT policy, wide open to any
// authenticated user, since every existing reader went through
// supabaseAdmin server-side and was never actually exposed to it. That's a
// real security boundary for a client-authenticated Realtime subscription
// (Realtime honors RLS when deciding what to broadcast), so this hook
// depends on the accompanying migration
// (20260822060000_sanaa_call_logs_realtime_rls.sql) tightening the policy
// to the caller's own client_id -- the `filter` below is a convenience,
// not the actual security control.
//
// A single call can fire several rapid updates (initiated -> answered ->
// hangup, plus a later transcript/summary write) -- debounced so one real
// call doesn't trigger 3-4 back-to-back refetches.
export function useSanaaCallsRealtime(clientId: string | null, onChange: () => void) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!clientId) return;

    const channel = supabase
      .channel(`owner-sanaa-calls:${clientId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sanaa_call_logs', filter: `client_id=eq.${clientId}` },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => onChangeRef.current(), 800);
        }
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [clientId]);
}
