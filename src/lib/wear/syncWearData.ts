import { getBooking, listBookingsForDate, customerDisplayName, serviceDisplayName, type OwnerBooking } from '@/lib/api/ownerBookings';
import { getDashboard } from '@/lib/api/ownerDashboard';
import { localDateKey } from '@/lib/calendar/timeGrid';
import { syncWearSchedule, type WearAppointment } from 'wear-bridge';

function toWearAppointment(b: OwnerBooking): WearAppointment {
  return {
    id: b.id,
    customerName: customerDisplayName(b),
    serviceName: serviceDisplayName(b),
    startsAtIso: b.starts_at,
    endsAtIso: b.ends_at ?? null,
    staffName: b.staff?.name ?? null,
    status: b.status,
  };
}

/**
 * P2 Wear OS foundation. Takes data the owner dashboard screen has already
 * fetched (nextAppointmentId from GET /api/owner/dashboard, todayBookings
 * from GET /api/owner/bookings) so this never issues a duplicate request of
 * its own for today's schedule -- only reuses existing owner APIs already
 * identified in the P0 audit, no new backend logic. The one extra call
 * (getBooking for the next appointment's full detail) is the same existing
 * endpoint the phone app's own Appointment Sheet already uses. Never sends
 * the owner's auth token to the watch -- only the derived, human-readable
 * appointment fields a wrist glance needs.
 *
 * Fire-and-forget: a wear-sync failure must never affect the owner
 * dashboard screen that calls this.
 */
export async function syncWearData(nextAppointmentId: string | null, todayBookings: OwnerBooking[]): Promise<void> {
  try {
    const today = todayBookings
      .filter((b) => b.status !== 'cancelled')
      .map(toWearAppointment);

    let next: WearAppointment | null = null;
    if (nextAppointmentId) {
      const inToday = todayBookings.find((b) => b.id === nextAppointmentId);
      if (inToday) {
        next = toWearAppointment(inToday);
      } else {
        // Next appointment isn't in today's list (e.g. it's tomorrow) --
        // fetch its detail the same way the phone app's Appointment Sheet
        // does, rather than guessing from partial data.
        const res = await getBooking(nextAppointmentId);
        if (res.ok) next = toWearAppointment(res.data.data);
      }
    }

    await syncWearSchedule(next, today);
  } catch {
    // Best-effort only -- see comment above.
  }
}

/**
 * P5 — on-demand full re-sync, used only right after a watch-initiated
 * Start/Complete action succeeds (so the watch's schedule reflects the
 * change without requiring the owner to also have the dashboard screen
 * open). Fetches the exact same two existing endpoints the dashboard
 * screen's own queries use, independently — this is the one place in the
 * wear bridge that issues its own network requests rather than reusing
 * already-fetched data, and only because there is no dashboard screen
 * mount to reuse data from when this fires.
 */
export async function refetchAndSyncWearData(): Promise<void> {
  try {
    const todayKey = localDateKey(new Date());
    const [dashRes, bookingsRes] = await Promise.all([getDashboard(), listBookingsForDate(todayKey)]);
    const nextAppointmentId = dashRes.ok ? dashRes.data.next_appointment_id : null;
    const todayBookings = bookingsRes.ok ? bookingsRes.data.data : [];
    await syncWearData(nextAppointmentId, todayBookings);
  } catch {
    // Best-effort only.
  }
}
