import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const PIN_HASH_KEY = 'bwa_pin_hash';

async function hashPin(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

export async function hasPin(): Promise<boolean> {
  const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
  return !!hash;
}

export async function setPin(pin: string): Promise<void> {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_HASH_KEY);
  if (!stored) return false;
  const hash = await hashPin(pin);
  return hash === stored;
}

export async function clearPin(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_HASH_KEY);
}
