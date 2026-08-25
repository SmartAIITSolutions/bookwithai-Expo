import AsyncStorage from '@react-native-async-storage/async-storage';

// Calendar 2.0 Day View sample/demo fixture toggle -- same __DEV__-gated
// AsyncStorage pattern already used by ownerSanaa.ts's dev state-switcher,
// so every visual state (SANAA/online/walk-in/manual/blocked/cancelled/
// no-show/deposit/overlap/smart-gap) can be reviewed on a real device
// without ever touching production data.
const KEY = '__calendar2_day_sample_mode';

export async function getDaySampleMode(): Promise<boolean> {
  if (!__DEV__) return false;
  return (await AsyncStorage.getItem(KEY)) === '1';
}

export async function setDaySampleMode(on: boolean): Promise<void> {
  if (!__DEV__) return;
  if (on) await AsyncStorage.setItem(KEY, '1');
  else await AsyncStorage.removeItem(KEY);
}
