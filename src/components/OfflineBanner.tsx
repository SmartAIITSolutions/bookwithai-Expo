import { View, Text, StyleSheet } from 'react-native';
import { useNetworkStatus } from '@/lib/hooks/useNetworkStatus';
import { Colors, Spacing } from '@/constants/Theme';

// App-wide "no internet" banner — the universal case every screen shares,
// on top of the per-screen retry-capable ErrorState for failed fetches.
export function OfflineBanner() {
  const isConnected = useNetworkStatus();
  if (isConnected) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.error,
    paddingVertical: 6,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
