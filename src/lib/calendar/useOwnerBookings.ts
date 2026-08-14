import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';

export function ownerBookingsQueryKey(clientId: string | null, date: string) {
  return ['owner-bookings', clientId, date] as const;
}

// Fetches a day's bookings (via React Query, so the same day's data is
// shared/cached across every screen that asks for it -- Dashboard and
// Calendar previously each fired their own independent network request for
// the exact same rows), then subscribes to Realtime changes on the
// bookings table (scoped to this owner's salon by the bookings_select_own_salon
// RLS policy) so check-ins, new bookings, or SANAA bookings appear instantly
// without polling -- matches Phase 0.6's "everything updates instantly, no
// refresh".
export function useOwnerBookings(date: string) {
  const { clientId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ownerBookingsQueryKey(clientId, date);

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await listBookingsForDate(date);
      if (!result.ok) throw new Error(result.error);
      return result.data.data;
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (!clientId) return;

    // Topic includes a per-mount nonce, not just clientId+date -- a
    // deterministic name risks calling .subscribe() on a new channel while
    // a just-unmounted instance's async removeChannel() for that same name
    // hasn't finished yet (e.g. Fast Refresh remounts, or a user rapidly
    // switching away and back), which throws "cannot add postgres_changes
    // callbacks ... after subscribe()".
    const channel = supabase
      .channel(`owner-bookings:${clientId}:${date}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `client_id=eq.${clientId}` },
        // Invalidating (not directly refetching) lets React Query dedupe
        // this against any other in-flight/queued refetch for the same key
        // -- e.g. Dashboard and Calendar both mounted at once.
        () => queryClient.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date]);

  return { bookings: data ?? ([] as OwnerBooking[]), loading: isLoading, reload: refetch };
}
