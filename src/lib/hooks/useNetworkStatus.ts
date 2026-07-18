import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// V1 gap closure — no connectivity detection existed anywhere. Screens use
// this to show the existing (previously unused) ErrorState component
// instead of a generic loading spinner or silent failure when offline.
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  return isConnected;
}
