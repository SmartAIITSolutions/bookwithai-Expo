import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const API_BASE = 'https://bookwithai.app';

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId;
}

async function getExpoPushToken(): Promise<string | null> {
  try {
    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return tokenResponse.data ?? null;
  } catch {
    // No Google Play Services (or similar) — genuinely can't get a token here.
    return null;
  }
}

// Requests OS notification permission (only actually shows a system dialog the
// first time ever — subsequent calls just report the existing status) and, if
// granted, registers this device's Expo push token with the backend, linking
// it to customerId if this is the first time it's being registered.
export async function requestAndRegisterPushToken(customerId?: string): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return false;

  const expoPushToken = await getExpoPushToken();
  if (!expoPushToken) return false;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  await fetch(`${API_BASE}/api/mobile/push-token`, {
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

  return true;
}

// Called on sign-out so a logged-out device stops receiving that account's pushes.
export async function unregisterPushToken(): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const expoPushToken = await getExpoPushToken();
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
