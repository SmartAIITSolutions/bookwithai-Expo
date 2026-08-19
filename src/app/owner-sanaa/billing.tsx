import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { getSanaaOffer, SanaaOfferResponse } from '@/lib/api/ownerSanaaOffer';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']} style={StyleSheet.absoluteFill} />
  );
}

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#0B0712' },
  headerTintColor: '#F4D77A',
  headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
  title: 'Plan & Billing',
  headerBackTitle: 'SANAA',
};

const STATUS_LABEL: Record<string, string> = {
  experience: 'Active — $5 SANAA Experience',
  active: 'Active subscription',
  past_due: 'Payment issue — grace period active',
  suspended: 'Suspended — payment needed',
  cancel_scheduled: 'Ending at the end of this billing period',
  cancelled: 'Ended',
  conversion_failed: 'Payment failed — needs a new payment method',
  conversion_action_required: 'Payment confirmation needed',
  converting: 'Finishing up…',
  incomplete: 'Checkout not completed',
};

// Manage-existing destination -- distinct from owner-sanaa/plans (browse/buy).
// Extended (not duplicated) now that a real commercial state exists to show.
export default function SanaaBillingScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offer, setOffer] = useState<SanaaOfferResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await getSanaaOffer();
    if (result.ok) setOffer(result.data);
    else setLoadError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <BreathingHeart size={40} color="#F4D77A" />
      </View>
    );
  }

  if (loadError || !offer) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={HEADER_OPTIONS} />
        <ErrorState message={loadError ?? undefined} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={HEADER_OPTIONS} />
      <ScrollView contentContainerStyle={styles.content}>
        {offer.current ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your SANAA Plan</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <Text style={styles.statusText}>{STATUS_LABEL[offer.current.status] ?? offer.current.status}</Text>
              {offer.current.experience_expires_at && offer.current.status === 'experience' && (
                <Text style={styles.hint}>
                  Experience ends {new Date(offer.current.experience_expires_at).toLocaleDateString()}, or after 30 calling minutes.
                </Text>
              )}
            </BlurView>
          </View>
        ) : (
          <View style={styles.section}>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <Text style={styles.emptyText}>You haven't started SANAA yet.</Text>
              <TouchableOpacity style={styles.plansButton} onPress={() => router.push('/owner-sanaa/plans')}>
                <Text style={styles.plansButtonText}>See Plans</Text>
              </TouchableOpacity>
            </BlurView>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#040108' },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110 },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.sm,
  },
  statusText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  hint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  emptyText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  plansButton: {
    alignSelf: 'flex-start', backgroundColor: '#F4D77A', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 9, marginTop: Spacing.xs,
  },
  plansButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#09000F' },
});
