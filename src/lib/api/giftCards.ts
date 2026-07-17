import { API_BASE } from '@/lib/config';

// Public route, not owner-authenticated (mirrors how the customer-facing
// pay page already calls it) — just needs client_id + code.
export async function validateGiftCard(clientId: string, code: string) {
  const res = await fetch(`${API_BASE}/api/gift-cards/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, code }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false as const, error: json.error || 'Invalid gift card' };
  return { ok: true as const, balance_cents: json.balance_cents as number, code: json.code as string };
}
