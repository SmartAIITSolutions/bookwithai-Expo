import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';

export type DeltechActionType = 'store_review' | 'facebook' | 'instagram' | 'tiktok';

export interface DeltechActionState {
  tapped_at: string | null;
  confirmed_at: string | null;
  skipped_at: string | null;
  skip_reason: string | null;
}

export interface DeltechStatus {
  enabled: boolean;
  headline: string;
  body: string;
  actions: Record<DeltechActionType, DeltechActionState>;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function fetchDeltechStatus(): Promise<DeltechStatus | null> {
  try {
    const headers = await authHeaders();
    if (!headers) return null;
    const res = await fetch(`${API_BASE}/api/mobile/deltech-support`, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function recordDeltechAction(
  actionType: DeltechActionType,
  kind: 'tap' | 'confirm' | 'skip',
  reason?: string,
): Promise<boolean> {
  try {
    const headers = await authHeaders();
    if (!headers) return false;
    const res = await fetch(`${API_BASE}/api/mobile/deltech-support`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action_type: actionType, kind, reason }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
