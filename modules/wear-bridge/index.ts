import { Platform } from 'react-native';

// Android-only native module — see expo-module.config.json. On iOS (and in
// any environment where the native module hasn't been linked yet, e.g.
// before `npm install` has resolved this local package) every export below
// is a safe no-op rather than a throw, so wiring this into a shared
// owner-only screen can never affect the existing iOS app or crash before
// the native side is built.
let WearBridgeNative: {
  syncRole: (role: WearRole) => Promise<boolean>;
  syncSchedule: (next: WearAppointment | null, today: WearAppointment[]) => Promise<boolean>;
  syncCustomerSchedule: (next: CustomerWearAppointment | null) => Promise<boolean>;
  sendNextOpeningResult: (startsAtIso: string | null, endsAtIso: string | null) => Promise<boolean>;
  sendActionResult: (action: string, bookingId: string, success: boolean, errorMessage: string | null) => Promise<boolean>;
  sendCustomerActionResult: (action: string, bookingId: string, success: boolean, errorMessage: string | null) => Promise<boolean>;
  addListener: (eventName: string, listener: (...args: unknown[]) => void) => { remove: () => void };
  removeListeners: (count: number) => void;
} | null = null;

if (Platform.OS === 'android') {
  try {
    // Deferred require — requireNativeModule throws if the native module
    // isn't linked yet (e.g. before the first native build after adding
    // this module), which must not crash JS-only work (Metro, type-checks).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core');
    WearBridgeNative = requireNativeModule('WearBridge');
  } catch {
    WearBridgeNative = null;
  }
}

export type WearRole = 'owner' | 'customer';

/** One appointment's wrist-relevant fields (professional view) — no pricing, notes, or PII beyond what a glance needs. */
export interface WearAppointment {
  id: string;
  customerName: string;
  serviceName: string;
  /** ISO 8601 */
  startsAtIso: string;
  /** ISO 8601, or null if unknown */
  endsAtIso: string | null;
  staffName: string | null;
  status: string;
}

/** One appointment's wrist-relevant fields (customer view). */
export interface CustomerWearAppointment {
  id: string;
  salonName: string;
  serviceName: string;
  startsAtIso: string;
  endsAtIso: string | null;
  status: string;
}

/**
 * P6 — tells the watch which experience (professional/customer) to show.
 * Call once role is known (see _layout.tsx). No-op on iOS / when no watch
 * is paired.
 */
export async function syncWearRole(role: WearRole): Promise<boolean> {
  if (!WearBridgeNative) return false;
  try {
    return await WearBridgeNative.syncRole(role);
  } catch {
    return false;
  }
}

/**
 * Pushes the current NEXT appointment + today's full schedule to any paired
 * Wear OS device via the Android Wearable Data Layer API (com.google.
 * android.gms:play-services-wearable — free, no usage charge). Resolves
 * false (never throws) when there's no watch paired, the native module
 * isn't linked yet, or the platform isn't Android — callers should treat
 * this as fire-and-forget.
 */
export async function syncWearSchedule(next: WearAppointment | null, today: WearAppointment[]): Promise<boolean> {
  if (!WearBridgeNative) return false;
  try {
    return await WearBridgeNative.syncSchedule(next, today);
  } catch {
    return false;
  }
}

/** P6 — customer analogue of syncWearSchedule: just the single next upcoming appointment. */
export async function syncWearCustomerSchedule(next: CustomerWearAppointment | null): Promise<boolean> {
  if (!WearBridgeNative) return false;
  try {
    return await WearBridgeNative.syncCustomerSchedule(next);
  } catch {
    return false;
  }
}

/**
 * P4 — subscribes to the watch's "when is my next opening" request
 * (sent via MessageClient when the owner uses that Ask SANAA command).
 * Returns a no-op unsubscribe function on iOS / before the native module
 * is linked, so callers can always call the returned function unconditionally.
 */
export function addAskNextOpeningListener(callback: () => void): () => void {
  if (!WearBridgeNative) return () => {};
  const sub = WearBridgeNative.addListener('onAskNextOpening', callback);
  return () => sub.remove();
}

/**
 * P4 — replies to a pending "next opening" request with the result of
 * calling the existing owner scheduling API. Pass nulls when no opening
 * was found in the search window.
 */
export async function sendNextOpeningResult(startsAtIso: string | null, endsAtIso: string | null): Promise<boolean> {
  if (!WearBridgeNative) return false;
  try {
    return await WearBridgeNative.sendNextOpeningResult(startsAtIso, endsAtIso);
  } catch {
    return false;
  }
}

export type WatchAction = 'start' | 'complete';

/**
 * P5 — subscribes to a Start/Complete request sent from the watch's
 * Appointment Detail screen. Returns a no-op unsubscribe function on iOS /
 * before the native module is linked.
 */
export function addWatchActionListener(callback: (action: WatchAction, bookingId: string) => void): () => void {
  if (!WearBridgeNative) return () => {};
  const sub = WearBridgeNative.addListener('onWatchAction', (event: unknown) => {
    const { action, bookingId } = event as { action: WatchAction; bookingId: string };
    callback(action, bookingId);
  });
  return () => sub.remove();
}

/**
 * P5 — replies to a pending Start/Complete request with the outcome of
 * calling the existing owner booking action (startService/completeService).
 */
export async function sendActionResult(
  action: WatchAction,
  bookingId: string,
  success: boolean,
  errorMessage?: string | null,
): Promise<boolean> {
  if (!WearBridgeNative) return false;
  try {
    return await WearBridgeNative.sendActionResult(action, bookingId, success, errorMessage ?? null);
  } catch {
    return false;
  }
}

export type WatchCustomerAction = 'arrived' | 'eta_almost' | 'eta_late' | 'cancel';

/**
 * P6 — subscribes to a customer action request (I've Arrived / Running
 * Late / Cancel) sent from the watch's customer Appointment Detail screen.
 * Returns a no-op unsubscribe function on iOS / before the native module
 * is linked.
 */
export function addWatchCustomerActionListener(
  callback: (action: WatchCustomerAction, bookingId: string) => void,
): () => void {
  if (!WearBridgeNative) return () => {};
  const sub = WearBridgeNative.addListener('onWatchCustomerAction', (event: unknown) => {
    const { action, bookingId } = event as { action: WatchCustomerAction; bookingId: string };
    callback(action, bookingId);
  });
  return () => sub.remove();
}

/**
 * P6 — replies to a pending customer action request with the outcome of
 * calling the existing customer booking action (checkInBooking/
 * sendEtaStatus/cancelBooking).
 */
export async function sendCustomerActionResult(
  action: WatchCustomerAction,
  bookingId: string,
  success: boolean,
  errorMessage?: string | null,
): Promise<boolean> {
  if (!WearBridgeNative) return false;
  try {
    return await WearBridgeNative.sendCustomerActionResult(action, bookingId, success, errorMessage ?? null);
  } catch {
    return false;
  }
}
