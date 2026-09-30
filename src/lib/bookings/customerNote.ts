// bookings.notes holds what the customer typed at booking time, but the
// backend also appends machine lines to that same column, which several
// server features rely on (payment matching, refunds, reports) -- so they
// must stay in the data and are only hidden here, at display time:
//   "Stripe checkout: cs_..."        web online payment
//   "Stripe payment: pi_..."         app payment for an existing booking
//   "Gift card CODE: −$X.XX ..."     gift card applied (web)
//   "Promo CODE: −$X.XX"             promo code applied (web)
const SYSTEM_NOTE_LINES = [
  /^Stripe (checkout|payment):\s*\S+\s*$/i,
  /^Gift card \S+: [−-]\$\d/,
  /^Promo \S+: [−-]\$\d/,
];

// Just the customer's own words, or null when there are none.
export function customerTypedNote(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const kept = notes
    .split(/\r?\n/)
    .filter(line => !SYSTEM_NOTE_LINES.some(re => re.test(line.trim())))
    .join('\n')
    .trim();
  return kept.length > 0 ? kept : null;
}
