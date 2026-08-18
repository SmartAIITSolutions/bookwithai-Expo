import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { SanaaDiscoveryHome } from '@/components/owner/sanaa/SanaaDiscoveryHome';
import { SanaaComingSoon } from '@/components/owner/sanaa/SanaaComingSoon';
import { SanaaSetupHome } from '@/components/owner/sanaa/SanaaSetupHome';
import { SanaaOperationsHome } from '@/components/owner/sanaa/SanaaOperationsHome';
import {
  getSanaaStatus, deriveSanaaLifecycle, SanaaLifecycle, SANAA_DISCOVERY_LIVE,
  getDevSanaaStateOverride, setDevSanaaStateOverride,
} from '@/lib/api/ownerSanaa';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

const ALL_STATES: SanaaLifecycle[] = [
  'non_subscriber', 'setup_not_started', 'setup_partial', 'ready_to_test',
  'ready_to_activate', 'live', 'paused', 'action_required',
];

// SANAA-P0/P1-SPEC §8/§26 -- lifecycle router. Tapping the SANAA tab must
// always land the owner in the experience matching their real state, not
// a generic home screen. Renders exactly one of Discovery/Setup/Operations.
export default function SanaaScreen() {
  const [devOverride, setDevOverride] = useState<SanaaLifecycle | null>(null);

  useEffect(() => {
    if (__DEV__) getDevSanaaStateOverride().then(setDevOverride);
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['owner-sanaa-status'],
    queryFn: async () => {
      const r = await getSanaaStatus();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  useRefetchOnFocus(refetch);

  async function pickDevState(state: SanaaLifecycle | null) {
    await setDevSanaaStateOverride(state);
    setDevOverride(state);
  }

  const lifecycle: SanaaLifecycle | null = devOverride ?? (data ? deriveSanaaLifecycle(data) : null);

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <OwnerScreenHeader title="SANAA" />

      {__DEV__ && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devRow}>
          <TouchableOpacity onPress={() => pickDevState(null)} style={[styles.devChip, !devOverride && styles.devChipActive]}>
            <Text style={[styles.devChipText, !devOverride && styles.devChipTextActive]}>Real</Text>
          </TouchableOpacity>
          {ALL_STATES.map((s) => (
            <TouchableOpacity key={s} onPress={() => pickDevState(s)} style={[styles.devChip, devOverride === s && styles.devChipActive]}>
              <Text style={[styles.devChipText, devOverride === s && styles.devChipTextActive]}>{s.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isLoading && !devOverride ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : error && !devOverride ? (
        <ErrorState message={(error as Error).message} onRetry={refetch} />
      ) : !lifecycle ? null : lifecycle === 'non_subscriber' ? (
        // P2 owns real Discovery Home content -- a production build must not
        // show placeholder-laden sections before that content exists.
        // __DEV__ (or once SANAA_DISCOVERY_LIVE flips true) previews the
        // real component; production sees one clean "coming soon" message.
        (__DEV__ || SANAA_DISCOVERY_LIVE) ? <SanaaDiscoveryHome /> : <SanaaComingSoon />
      ) : ['setup_not_started', 'setup_partial', 'ready_to_test', 'ready_to_activate'].includes(lifecycle) ? (
        <SanaaSetupHome state={lifecycle} />
      ) : (
        <SanaaOperationsHome state={lifecycle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  devRow: { gap: 6, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  devChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  devChipActive: { backgroundColor: '#8B5CFF', borderColor: '#8B5CFF' },
  devChipText: { fontFamily: FontFamily.sora, fontSize: 10, color: 'rgba(255,255,255,0.6)' },
  devChipTextActive: { color: '#FFFFFF', fontFamily: FontFamily.soraSemiBold },
});
