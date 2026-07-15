/**
 * usePressHaptic — wraps any press handler with light haptic feedback.
 * Requires: npx expo install expo-haptics
 */
import * as Haptics from 'expo-haptics';

type Handler = (...args: any[]) => any;

export function withHaptic<T extends Handler>(handler: T): T {
  return ((...args: Parameters<T>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    return handler(...args);
  }) as T;
}

export function withHapticMedium<T extends Handler>(handler: T): T {
  return ((...args: Parameters<T>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    return handler(...args);
  }) as T;
}

export function notificationSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function notificationError() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
