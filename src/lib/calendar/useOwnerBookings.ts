import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { listBookingsForDate, OwnerBooking } from '@/lib/api/ownerBookings';

// Fetches a day's bookings, then subscribes to Realtime changes on the
// bookings table (scoped to this owner's salon by the bookings_select_own_salon
// RLS policy) so check-ins, new bookings, or SANAA bookings appear instantly
// without polling — matches Phase 0.6's "everything updates instantly, no refresh".
export function useOwnerBookings(date: string) {
  const { clientId } = useAuth();
  const [bookings, setBookings] = useState<OwnerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const result = await listBookingsForDate(date);
    if (result.ok) setBookings(result.data.data);
    setLoading(false);
  }, [date]);

  useEffect(() => { reload(); }, [reload]);

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
        () => reload() // simple, correct refetch-on-change; fine-grained patching can come later
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, date, reload]);

  return { bookings, loading, reload };
}
