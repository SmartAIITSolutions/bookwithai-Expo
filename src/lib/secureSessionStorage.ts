import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import 'react-native-get-random-values';

/**
 * P12.7 — LargeSecureStore, Supabase's own documented pattern for Expo/React
 * Native (supabase.com/docs "with-expo-react-native" guide), not a
 * custom-invented scheme.
 *
 * Why not SecureStore alone: it's backed by the iOS Keychain / Android
 * Keystore, and Android's SharedPreferences backing has a documented, hard
 * 2048-byte-per-value limit -- smaller than a real Supabase session (access
 * token JWT + refresh token + user metadata routinely exceeds that).
 * AsyncStorage has no such size limit but stores plaintext.
 *
 * This adapter splits the two: the session value itself is AES-256-CTR
 * encrypted (via aes-js, a standard library implementation -- no
 * hand-rolled cryptography) and stored in AsyncStorage; only the small
 * (32-byte) encryption key lives in SecureStore. The session is never at
 * rest in plaintext on disk either way.
 *
 * Migration: an existing signed-in user has their session sitting in
 * plaintext AsyncStorage under this same key (the pre-P12 storage
 * location -- this app's plain `createClient({ auth: { storage:
 * AsyncStorage } })` config). getItem() detects this (no SecureStore key
 * exists yet for that storage key) and migrates it in place: encrypt,
 * write the SecureStore key FIRST, then the encrypted AsyncStorage value
 * -- if either write fails, the SecureStore key is rolled back and the
 * plaintext is left untouched, so a failed migration can never destroy the
 * session or sign the user out. Only once both writes succeed is the
 * plaintext considered superseded (overwritten by the encrypted value in
 * the same slot).
 */
class LargeSecureStore {
  private async encrypt(storageKey: string, value: string): Promise<string> {
    const encryptionKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const encryptionKeyHex = aesjs.utils.hex.fromBytes(encryptionKeyBytes);

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKeyBytes, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(storageKey, encryptionKeyHex);
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(encryptionKeyHex: string, encryptedHex: string): Promise<string> {
    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(encryptedHex));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(storageKey: string): Promise<string | null> {
    const rawValue = await AsyncStorage.getItem(storageKey);
    if (!rawValue) return null;

    const encryptionKeyHex = await SecureStore.getItemAsync(storageKey);

    if (encryptionKeyHex) {
      // Already migrated -- rawValue is the encrypted blob.
      try {
        return await this.decrypt(encryptionKeyHex, rawValue);
      } catch (err) {
        console.error('[secureSessionStorage] decrypt failed, treating session as unreadable:', err);
        return null;
      }
    }

    // No encryption key on file for this storage key -- rawValue must be
    // the pre-P12 plaintext session (nothing could have been encrypted
    // under this key without a SecureStore entry existing). Migrate it.
    let newEncryptionKeyHex: string | null = null;
    try {
      const encryptionKeyBytes = crypto.getRandomValues(new Uint8Array(32));
      newEncryptionKeyHex = aesjs.utils.hex.fromBytes(encryptionKeyBytes);
      const cipher = new aesjs.ModeOfOperation.ctr(encryptionKeyBytes, new aesjs.Counter(1));
      const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(rawValue));
      const encryptedHex = aesjs.utils.hex.fromBytes(encryptedBytes);

      // Key written first -- if the next write fails, roll it back below
      // rather than leaving a SecureStore key with no matching encrypted
      // value (which would make the plaintext unreadable as "encrypted"
      // on the next getItem call).
      await SecureStore.setItemAsync(storageKey, newEncryptionKeyHex);
      await AsyncStorage.setItem(storageKey, encryptedHex);
      console.log(`[secureSessionStorage] migrated ${storageKey} from plaintext AsyncStorage to encrypted storage`);
    } catch (err) {
      console.error('[secureSessionStorage] migration failed, leaving plaintext session in place:', err);
      if (newEncryptionKeyHex) {
        await SecureStore.deleteItemAsync(storageKey).catch(() => {});
      }
    }

    // Return the value we already have in hand either way -- no need to
    // re-read/re-decrypt what we just wrote (or failed to).
    return rawValue;
  }

  async setItem(storageKey: string, value: string): Promise<void> {
    const encryptedHex = await this.encrypt(storageKey, value);
    await AsyncStorage.setItem(storageKey, encryptedHex);
  }

  async removeItem(storageKey: string): Promise<void> {
    await AsyncStorage.removeItem(storageKey);
    await SecureStore.deleteItemAsync(storageKey).catch(() => {});
  }
}

export const secureSessionStorage = new LargeSecureStore();
