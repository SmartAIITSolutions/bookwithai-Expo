import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const API_BASE = 'https://bookwithai.app';

// Structured diagnostic tags for push-registration outcomes. Console-only for
// now (no app-wide logging/analytics pipeline exists yet to route these to) --
// deliberately not a new logging system, just consistently-shaped log lines
// so a registration failure is at minimum visible in device/Metro logs
// instead of vanishing into a silently-swallowed catch block.
const PUSH_REGISTRATION_PERMISSION_DENIED = 'PUSH_REGISTRATION_PERMISSION_DENIED';
const PUSH_REGISTRATION_TOKEN_FAILED      = 'PUSH_REGISTRATION_TOKEN_FAILED';
const PUSH_REGISTRATION_BACKEND_FAILED    = 'PUSH_REGISTRATION_BACKEND_FAILED';
const PUSH_REGISTRATION_SUCCESS           = 'PUSH_REGISTRATION_SUCCESS';

// Replaces the old ambiguous boolean return. A device is only actually
// registered for server push delivery when status is 'success' -- permission
// being granted is necessary but not sufficient, since the Expo token fetch
// or the backend save can still fail independently of OS permission state.
export type PushRegistrationResult =
  | { status: 'success' }
  | { status: 'permission_denied' }
  | { status: 'token_failed' }
  | { status: 'backend_failed' }

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

async function getExpoPushToken(): Promise<{ token: string | null; error?: unknown }> {
  try {
    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return { token: tokenResponse.data ?? null };
  } catch (error) {
    // No Google Play Services (or similar) — genuinely can't get a token here.
    return { token: null, error };
  }
}

// Requests OS notification permission (only actually shows a system dialog the
// first time ever — subsequent calls just report the existing status) and, if
// granted, registers this device's Expo push token with the backend, linking
// it to customerId if this is the first time it's being registered.
//
// Every exit path logs a structured PUSH_REGISTRATION_* tag so a failure is
// at least visible somewhere (device/Metro console) instead of vanishing --
// this was previously a silent `return false`/swallowed catch with zero
// trace, which is how two real customer accounts ended up with OS permission
// granted but no row in push_tokens and no way to tell why.
//
// 'success' requires ALL of: permission granted + Expo token obtained +
// backend save returned 2xx. Anything less is not registration success --
// a device that fails the backend save has permission granted but is not
// actually reachable by a server push, which is the exact symptom this was
// built to eliminate, so callers must not treat that as "enabled."
export async function requestAndRegisterPushToken(customerId?: string): Promise<PushRegistrationResult> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log(`[push-registration] ${PUSH_REGISTRATION_PERMISSION_DENIED}`, { status: finalStatus });
    return { status: 'permission_denied' };
  }

  const { token: expoPushToken, error: tokenError } = await getExpoPushToken();
  if (!expoPushToken) {
    console.warn(`[push-registration] ${PUSH_REGISTRATION_TOKEN_FAILED}`, tokenError);
    return { status: 'token_failed' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn(`[push-registration] ${PUSH_REGISTRATION_BACKEND_FAILED}`, { reason: 'no_session' });
    return { status: 'backend_failed' };
  }

  try {
    const res = await fetch(`${API_BASE}/api/mobile/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        expo_push_token: expoPushToken,
        device_type: Platform.OS,
        customer_id: customerId,
      }),
    });

    if (!res.ok) {
      console.warn(`[push-registration] ${PUSH_REGISTRATION_BACKEND_FAILED}`, {
        status: res.status,
        body: await res.text().catch(() => undefined),
      });
      return { status: 'backend_failed' };
    }

    console.log(`[push-registration] ${PUSH_REGISTRATION_SUCCESS}`, { device_type: Platform.OS });
    return { status: 'success' };
  } catch (error) {
    console.warn(`[push-registration] ${PUSH_REGISTRATION_BACKEND_FAILED}`, { reason: 'network_error', error });
    return { status: 'backend_failed' };
  }
}

// Called on sign-out so a logged-out device stops receiving that account's pushes.
export async function unregisterPushToken(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const { token: expoPushToken } = await getExpoPushToken();
    if (!expoPushToken) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${API_BASE}/api/mobile/push-token`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
  } catch {
    // best-effort — never block sign-out on this
  }
}

export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}
