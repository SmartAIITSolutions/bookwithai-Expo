import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { SanaaDemoScenario } from '@/lib/sanaa/discoveryContent';
import { SanaaBookingDemoSimulation } from './SanaaBookingDemoSimulation';
import { trackSanaaEvent } from '@/lib/analytics/sanaaEvents';

interface SanaaDemoPlayerProps {
  scenario: SanaaDemoScenario;
}

// UI-boundary component only -- no playback dependency added yet
// (SANAA-P2-SPEC correction #1). This is exactly where a real Expo-
// compatible player plugs in once media exists and a format is chosen;
// today every 'media' scenario has no mediaAsset configured, so this
// always renders the honest "unavailable" fallback for them (§36) rather
// than a broken/dead player.
export function SanaaDemoPlayer({ scenario }: SanaaDemoPlayerProps) {
  const [retryCount, setRetryCount] = useState(0);

  if (scenario.kind === 'simulation') {
    return <SanaaBookingDemoSimulation />;
  }

  // kind === 'media', mediaAsset is not yet a real field (no playback
  // dependency chosen) -- always the unavailable state for now.
  return (
    <View style={styles.unavailable}>
      <Ionicons name="videocam-off-outline" size={26} color="rgba(255,200,87,0.6)" />
      <Text style={styles.unavailableTitle}>Demo unavailable right now</Text>
      <Text style={styles.unavailableBody}>This scenario's demo is coming soon.</Text>
      <Pressable
        style={styles.retryButton}
        onPress={() => {
          setRetryCount((n) => n + 1);
          trackSanaaEvent('demo_failed', { scenario: scenario.id, retry: retryCount + 1 });
        }}
      >
        <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.7)" />
        <Text style={styles.retryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  unavailable: {
    borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,200,87,0.35)',
    backgroundColor: 'rgba(0,0,0,0.15)', padding: Spacing.xl, alignItems: 'center', gap: Spacing.xs,
  },
  unavailableTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF', marginTop: Spacing.xs },
  unavailableBody: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  retryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  retryButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)' },
});
