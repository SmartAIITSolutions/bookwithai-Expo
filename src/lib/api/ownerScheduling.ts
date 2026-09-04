import { ownerFetch } from './ownerApi';

export interface NextOpening {
  starts_at: string | null;
  ends_at: string | null;
}

/**
 * P4 — thin wrapper around the new GET /api/owner/scheduling/next-opening
 * (see that route's own header comment for its v1 scoping). Used only by
 * the Wear OS "When is my next opening?" Ask SANAA command's phone-side
 * handler — not called anywhere else in the app in this phase.
 */
export async function getNextOpening() {
  return ownerFetch<{ data: NextOpening }>('/api/owner/scheduling/next-opening');
}
