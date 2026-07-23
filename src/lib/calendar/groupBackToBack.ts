import { OwnerBooking } from '@/lib/api/ownerBookings';

// A customer booked for multiple services in one visit -- back-to-back, no
// gap between them -- should be treated as ONE appointment, not one per
// service. Some booking-creation paths (the owner mobile app's
// single-service Walk-In flow, for one) can't yet attach multiple services
// to a single row, so this groups what's already loaded rather than
// requiring every booking to have used `service_line_ids` correctly.
// Mirrors booking-app's src/lib/bookings/group-back-to-back.ts.
export function groupBackToBackBookings(bookings: OwnerBooking[]): OwnerBooking[][] {
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const groups: OwnerBooking[][] = [];
  for (const booking of sorted) {
    const lastGroup = groups[groups.length - 1];
    const lastBooking = lastGroup?.[lastGroup.length - 1];
    const contiguous =
      lastBooking != null &&
      booking.customer_id != null &&
      lastBooking.customer_id === booking.customer_id &&
      new Date(lastBooking.ends_at).getTime() === new Date(booking.starts_at).getTime();

    if (contiguous) {
      lastGroup.push(booking);
    } else {
      groups.push([booking]);
    }
  }
  return groups;
}
