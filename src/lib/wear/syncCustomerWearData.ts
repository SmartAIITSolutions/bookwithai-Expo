import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';
import { syncWearCustomerSchedule, type CustomerWearAppointment } from 'wear-bridge';

export interface MyBookingForWear {
  id: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  service?: { name: string } | null;
  service_names?: string[];
  agency_clients?: { business_name: string } | null;
}

function serviceLabel(b: MyBookingForWear): string {
  if (b.service_names && b.service_names.length > 0) return b.service_names.join(' + ');
  return b.service?.name ?? 'Appointment';
}

/**
 * P6 (Wear OS customer). Takes the bookings list the My Bookings screen has
 * already fetched from the existing GET /api/mobile/my-bookings (no
 * duplicate request, no new backend logic), finds the single next upcoming
 * non-cancelled appointment, and pushes it to a paired watch. Only ever the
 * one appointment -- customers have no "today list" concept on the watch,
 * per this phase's scope (glance -> notify -> act, not a mini calendar).
 * Fire-and-forget: a wear-sync failure must never affect the screen that
 * calls this.
 */
export async function syncCustomerWearData(bookings: MyBookingForWear[]): Promise<void> {
  try {
    const now = Date.now();
    const next = bookings
      .filter((b) => b.status !== 'cancelled' && new Date(b.starts_at).getTime() >= now)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];

    const payload: CustomerWearAppointment | null = next
      ? {
          id: next.id,
          salonName: next.agency_clients?.business_name ?? 'Your salon',
          serviceName: serviceLabel(next),
          startsAtIso: next.starts_at,
          endsAtIso: next.ends_at ?? null,
          status: next.status,
        }
      : null;

    await syncWearCustomerSchedule(payload);
  } catch {
    // Best-effort only -- see comment above.
  }
}

/**
 * P6 — on-demand full re-sync, used only right after a watch-initiated
 * customer action (I've Arrived / Running Late / Cancel) succeeds, so the
 * watch's appointment reflects the change without requiring My Bookings to
 * also be open. Fetches the same existing GET /api/mobile/my-bookings
 * independently -- the one place in the customer wear bridge that issues
 * its own network request, mirroring refetchAndSyncWearData() on the
 * owner side.
 */
export async function refetchAndSyncCustomerWearData(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`${API_BASE}/api/mobile/my-bookings`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    await syncCustomerWearData((json.data ?? []) as MyBookingForWear[]);
  } catch {
    // Best-effort only.
  }
}
