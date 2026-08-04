// Mirrors booking-app/src/lib/stripe/fees.ts exactly -- pure arithmetic, no
// DB lookups, so it's safe to duplicate client-side for the checkout
// preview rather than round-trip to the server on every keystroke. The
// backend (createSalonBalanceCheckoutSession) is the actual source of
// truth for what gets charged; this is a preview only.
export const PLATFORM_FEE_CENTS        = 20;     // $0.20 minimum per transaction
export const PLATFORM_FEE_FREE_PERCENT = 0.01;   // 1%   — platform fee rate
export const STRIPE_RATE               = 0.029;  // 2.9%
export const STRIPE_FIXED_CENTS        = 30;     // $0.30

export function getPlatformFeeCents(totalChargeCents: number): number {
  return Math.max(PLATFORM_FEE_CENTS, Math.round(totalChargeCents * PLATFORM_FEE_FREE_PERCENT));
}

// In-salon card checkout (visit balance already computed).
export function cardChargeFromVisitDueCents(visitDueCents: number, passStripeFee?: boolean): {
  preTotalCents: number;
  totalChargeCents: number;
  stripeFeesCents: number;
  platformFeeCents: number;
} {
  const preTotalCents = Math.max(0, Math.round(visitDueCents));
  if (preTotalCents === 0) {
    return { preTotalCents: 0, totalChargeCents: 0, stripeFeesCents: 0, platformFeeCents: 0 };
  }
  const platformFeeCents = getPlatformFeeCents(preTotalCents);
  let totalChargeCents: number;
  let stripeFeesCents: number;
  if (passStripeFee) {
    totalChargeCents = Math.round((preTotalCents + platformFeeCents + STRIPE_FIXED_CENTS) / (1 - STRIPE_RATE));
    stripeFeesCents = Math.round(totalChargeCents * STRIPE_RATE + STRIPE_FIXED_CENTS);
  } else {
    totalChargeCents = preTotalCents;
    stripeFeesCents = Math.round(totalChargeCents * STRIPE_RATE + STRIPE_FIXED_CENTS);
  }
  return { preTotalCents, totalChargeCents, stripeFeesCents, platformFeeCents };
}
