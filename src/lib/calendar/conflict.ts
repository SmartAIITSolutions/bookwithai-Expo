// Mirrors booking-app's src/lib/booking-staff-conflict.ts exactly — kept in
// sync manually since the two are separate repos/packages. Salon-wide
// bookings (staff_id null) conflict with everyone; assigned staff only
// conflicts with the same staff member.
export function bookingStaffScopesConflictClient(
  candidateStaffId: string | null | undefined,
  existingStaffId: string | null | undefined,
): boolean {
  const ex = existingStaffId ?? null;
  const cand = candidateStaffId ?? null;
  if (ex === null) return true;
  if (cand === null) return true;
  return ex === cand;
}
