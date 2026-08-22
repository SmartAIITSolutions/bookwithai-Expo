import { ownerFetch } from './ownerApi';

export type SanaaTestState = 'not_started' | 'test_started' | 'call_verified' | 'test_completed';

export interface SanaaTestCallEvidence {
  started_at: string | null;
  status: string | null;
  duration_seconds: number | null;
}

export interface SanaaTestStartResponse {
  telnyx_number: string;
  test_session_started_at: string;
}

export interface SanaaTestStatusResponse {
  state: SanaaTestState;
  telnyx_number: string | null;
  test_session_started_at: string | null;
  test_call_completed_at: string | null;
  call: SanaaTestCallEvidence | null;
}

export interface SanaaTestConfirmResponse {
  test_call_completed_at: string;
}

// Stamps the Test session server-side before the owner places the real
// call -- the correlation anchor every later verification query is scoped
// to. Safe to call again to restart a session (moves the anchor forward).
export function startSanaaTest() {
  return ownerFetch<SanaaTestStartResponse>('/api/owner/sanaa/test/start', { method: 'POST' });
}

// Read-only poll -- never writes. Reports whether a real, Telnyx-verified
// call has landed since the current Test session started.
export function getSanaaTestStatus() {
  return ownerFetch<SanaaTestStatusResponse>('/api/owner/sanaa/test/status');
}

// The owner's explicit "yes, it sounded right" action. Server re-verifies
// the qualifying call independently -- this call can fail (422) even after
// getSanaaTestStatus() reported call_verified, if e.g. the session was
// restarted in another tab; callers should surface that error rather than
// assuming success.
export function confirmSanaaTest() {
  return ownerFetch<SanaaTestConfirmResponse>('/api/owner/sanaa/test/confirm', { method: 'POST' });
}
