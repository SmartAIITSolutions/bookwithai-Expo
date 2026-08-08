import { API_BASE } from '@/lib/config';

export interface AppVersionInfo {
  latest_version: string;
  release_notes: string | null;
}

export async function fetchLatestAppVersion(platform: 'ios' | 'android'): Promise<AppVersionInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/mobile/app-version`);
    if (!res.ok) return null;
    const json = await res.json();
    return json[platform] ?? null;
  } catch {
    // Fail open -- a version-check outage must never block the app itself.
    return null;
  }
}

// Numeric dotted-version comparison ("1.0.10" > "1.0.9"), not a plain
// string compare which would get that case backwards.
export function isVersionNewer(latest: string, installed: string): boolean {
  const a = latest.split('.').map(n => parseInt(n, 10) || 0);
  const b = installed.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}
