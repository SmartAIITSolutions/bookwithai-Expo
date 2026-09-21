import { Platform } from 'react-native';

// Android-only native module — see expo-module.config.json. On iOS (and in
// any environment where the native module hasn't been linked yet, e.g.
// before `npm install` has resolved this local package) commitAutofill()
// is a safe no-op rather than a throw, same pattern as wear-bridge. iOS
// doesn't need this at all -- UIKit already triggers its own Keychain
// save prompt from the text fields' textContentType alone, no explicit
// commit call required there.
let AutofillBridgeNative: { commit: () => boolean } | null = null;

if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { requireNativeModule } = require('expo-modules-core');
    AutofillBridgeNative = requireNativeModule('AutofillBridge');
  } catch {
    AutofillBridgeNative = null;
  }
}

/**
 * Tells Android's AutofillManager the current form (sign-in or sign-up)
 * was just submitted successfully, so the OS can offer to save the
 * credential the user typed -- without this, React Native's JS-driven
 * navigation away from the screen never triggers that prompt on its own.
 * Call this once, right after a successful auth call, before navigating
 * away. No-op (returns false) on iOS or before the native module is
 * linked; never throws.
 */
export function commitAutofill(): boolean {
  if (!AutofillBridgeNative) return false;
  try {
    return AutofillBridgeNative.commit();
  } catch {
    return false;
  }
}
