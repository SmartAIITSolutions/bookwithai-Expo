import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';

export function ownerBookingsQueryKey(clientId: string | null, date: string) {
  return ['owner-bookings', clientId, date] as const;
}

// Days fetched silently around the one on screen (yesterday + the next 6),
// so swiping/stepping to a neighbouring day renders from cache instead of
// a full-screen spinner.
const NEIGHBOUR_DAY_OFFSETS = [-1, 1, 2, 3, 4, 5, 6];
// A prefetched neighbour younger than this isn't re-fetched on every swipe;
// Realtime (below) marks every cached day stale on any booking change.
const NEIGHBOUR_STALE_MS = 5 * 60 * 1000;
// Keep calendar days in memory (and in the persisted cache) for a day
// rather than React Query's 5-minute default, so days loaded earlier are
// still there when the owner comes back to them.
const DAY_GC_MS = 24 * 60 * 60 * 1000;

// 'YYYY-MM-DD' + n calendar days. Done at UTC noon so DST can't shift it.
function shiftDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fetchDay(date: string) {
  return async () => {
    const result = await listBookingsForDate(date);
    if (!result.ok) throw new Error(result.error);
    return result.data.data;
  };
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
    queryFn: fetchDay(date),
    enabled: !!clientId,
    gcTime: DAY_GC_MS,
  });
  const hasData = data !== undefined;

  // Once the day on screen has loaded (so it always goes first), quietly
  // fetch its neighbours. prefetchQuery skips any day already cached and
  // fresher than NEIGHBOUR_STALE_MS, so this doesn't refetch on every swipe.
  useEffect(() => {
    if (!clientId || !hasData) return;
    for (const offset of NEIGHBOUR_DAY_OFFSETS) {
      const day = shiftDateKey(date, offset);
      queryClient.prefetchQuery({
        queryKey: ownerBookingsQueryKey(clientId, day),
        queryFn: fetchDay(day),
        staleTime: NEIGHBOUR_STALE_MS,
        gcTime: DAY_GC_MS,
      });
    }
  }, [clientId, date, hasData, queryClient]);

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
        // -- e.g. Dashboard and Calendar both mounted at once. Covers every
        // cached day for this salon (not just the one on screen): a change
        // can land on any day, including silently prefetched neighbours.
        // Only days currently on screen refetch now; the rest are just
        // marked stale and refresh in the background when next shown.
        () => queryClient.invalidateQueries({ queryKey: ['owner-bookings', clientId] })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, date]);

  return { bookings: data ?? ([] as OwnerBooking[]), loading: isLoading, reload: refetch };
}
