import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Stack } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import {
  getSanaaOffer, startSanaaCheckout, confirmSanaaCheckout,
  SanaaOfferResponse, SanaaVoicePlan, SanaaFoundingOffer,
} from '@/lib/api/ownerSanaaOffer';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#0B0712' },
  headerTintColor: '#F4D77A',
  headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
  title: 'SANAA Plans',
  headerBackTitle: 'SANAA',
};

const RETURN_URL = 'https://bookwithai.app';

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

// SANAA commercial-to-setup bridge — the real owner-facing Plans/Offer
// screen. Every price, eligibility decision, and Founding term shown here
// comes from GET /api/owner/sanaa/offer -- nothing is hardcoded client-side.
export default function SanaaPlansScreen() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offer, setOffer] = useState<SanaaOfferResponse | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await getSanaaOffer();
    if (result.ok) {
      setOffer(result.data);
      const firstPlanId = result.data.founding_offer?.plan_prices[0]?.voice_plan_id ?? result.data.plans[0]?.id ?? null;
      setSelectedPlanId(firstPlanId);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runCheckout(offerType: 'experience' | 'plan', planId: string, campaignId?: string) {
    setPurchasing(true);
    const result = await startSanaaCheckout({
      offer: offerType,
      plan_id: planId,
      campaign_id: campaignId,
      success_url: RETURN_URL,
      cancel_url: RETURN_URL,
    });
    setPurchasing(false);
    if (!result.ok) {
      Alert.alert('Could not start checkout', result.error);
      return;
    }

    await WebBrowser.openBrowserAsync(result.data.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#09000F',
      controlsColor: '#F4D77A',
    });

    // Mobile never declares success itself -- poll the server-side
    // reconciliation endpoint (the same one the webhook races against)
    // until it confirms, or give up after a bounded number of attempts.
    setConfirming(true);
    let confirmed = false;
    for (let attempt = 0; attempt < 15 && !confirmed; attempt++) {
      await new Promise(r => setTimeout(r, 2000));
      const check = await confirmSanaaCheckout(result.data.session_id);
      if (check.ok && check.data.status === 'confirmed') {
        confirmed = true;
      }
    }
    setConfirming(false);
    await load();

    if (confirmed) {
      Alert.alert('You’re in!', 'Your SANAA purchase is confirmed. Head to Setup to activate your AI receptionist.');
    } else {
      Alert.alert(
        'Still confirming',
        'We’re still confirming your payment with Stripe. Check back here shortly — this can take a minute.',
      );
    }
  }

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
        {confirming && (
          <View style={styles.section}>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.confirmingRow}>
                <BreathingHeart size={20} color="#F4D77A" />
                <Text style={styles.confirmingText}>Confirming SANAA purchase…</Text>
              </View>
            </BlurView>
          </View>
        )}

        {offer.current ? (
          <CurrentStateCard current={offer.current} />
        ) : (
          <>
            {offer.founding_offer && (
              <FoundingSection
                founding={offer.founding_offer}
                plans={offer.plans}
                selectedPlanId={selectedPlanId}
                onSelectPlan={setSelectedPlanId}
                onStart={() => selectedPlanId && runCheckout('experience', selectedPlanId, offer.founding_offer!.campaign_id)}
                purchasing={purchasing}
              />
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Standard Plans</Text>
              {offer.plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onSubscribe={() => runCheckout('plan', plan.id)}
                  disabled={purchasing}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function CurrentStateCard({ current }: { current: NonNullable<SanaaOfferResponse['current']> }) {
  const label: Record<string, string> = {
    experience: 'Your $5 SANAA Experience is active',
    active: 'Your SANAA subscription is active',
    past_due: 'Payment issue — grace period active',
    suspended: 'SANAA is suspended — payment needed',
    cancel_scheduled: 'Your subscription is ending at the end of this billing period',
    cancelled: 'Your SANAA subscription has ended',
    conversion_failed: 'Your Experience ended and payment failed — a new payment method is needed',
    conversion_action_required: 'Payment confirmation needed to continue SANAA',
    converting: 'Finishing up your SANAA setup…',
    incomplete: 'Checkout not completed yet',
  };
  return (
    <View style={styles.section}>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        <Text style={styles.currentStatusText}>{label[current.status] ?? current.status}</Text>
        {current.experience_expires_at && current.status === 'experience' && (
          <Text style={styles.hint}>
            Experience ends {new Date(current.experience_expires_at).toLocaleDateString()} or after 30 calling minutes, whichever comes first.
          </Text>
        )}
      </BlurView>
    </View>
  );
}

function FoundingSection({
  founding, plans, selectedPlanId, onSelectPlan, onStart, purchasing,
}: {
  founding: SanaaFoundingOffer;
  plans: SanaaVoicePlan[];
  selectedPlanId: string | null;
  onSelectPlan: (id: string) => void;
  onStart: () => void;
  purchasing: boolean;
}) {
  const priceFor = (planId: string) => founding.plan_prices.find(p => p.voice_plan_id === planId)?.monthly_price_override_cents;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{founding.name}</Text>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        <Text style={styles.foundingHeadline}>Try SANAA for {formatDollars(founding.experience_price_cents)}</Text>
        <Text style={styles.hint}>
          {founding.experience_minutes_cap} calling minutes or {founding.experience_days_cap} days, whichever comes first.
          Cancel anytime during your Experience — no further charge.
        </Text>

        <View style={styles.tierRow}>
          {plans.map(plan => {
            const foundingPrice = priceFor(plan.id);
            if (foundingPrice == null) return null;
            const active = selectedPlanId === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                style={[styles.tierChip, active && styles.tierChipActive]}
                onPress={() => onSelectPlan(plan.id)}
              >
                <Text style={[styles.tierChipText, active && styles.tierChipTextActive]}>{plan.name}</Text>
                <Text style={[styles.tierChipPrice, active && styles.tierChipTextActive]}>
                  {formatDollars(foundingPrice)}/mo
                </Text>
                <Text style={[styles.tierChipStandard, active && styles.tierChipTextActive]}>
                  vs {formatDollars(plan.monthly_price_cents)} standard
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.activationRow}>
          <Text style={styles.hint}>
            Activation: {formatDollars(founding.activation_fee_cents)} Founding rate (vs standard {plans[0] ? formatDollars(plans[0].activation_fee_cents) : '$99'}) —
            waived after {founding.activation_fee_waiver_cycles} successful monthly payments.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.startButton, purchasing && styles.startButtonDisabled]}
          onPress={onStart}
          disabled={purchasing || !selectedPlanId}
        >
          <Text style={styles.startButtonText}>{purchasing ? 'Starting…' : `Start My ${formatDollars(founding.experience_price_cents)} Experience`}</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

function PlanCard({ plan, onSubscribe, disabled }: { plan: SanaaVoicePlan; onSubscribe: () => void; disabled: boolean }) {
  return (
    <BlurView intensity={90} tint="dark" style={[styles.card, styles.planCard]}>
      <CardOverlay />
      <View style={{ flex: 1 }}>
        <Text style={styles.planName}>{plan.name}</Text>
        <Text style={styles.planDetail}>{formatDollars(plan.monthly_price_cents)}/mo — {plan.included_minutes} minutes included</Text>
        <Text style={styles.hint}>{formatDollars(plan.overage_rate_cents_per_min)}/min overage · {formatDollars(plan.activation_fee_cents)} activation</Text>
      </View>
      <TouchableOpacity style={styles.subscribeButton} onPress={onSubscribe} disabled={disabled}>
        <Text style={styles.subscribeButtonText}>Subscribe</Text>
      </TouchableOpacity>
    </BlurView>
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
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: Spacing.sm,
  },
  hint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', lineHeight: FontSize.xs * 1.5 },

  confirmingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  confirmingText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },

  currentStatusText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },

  foundingHeadline: { fontFamily: FontFamily.frauncesBold, fontSize: 20, color: '#F4D77A' },
  tierRow: { flexDirection: 'row', gap: 8, marginTop: Spacing.xs },
  tierChip: {
    flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  tierChipActive: { backgroundColor: 'rgba(255,200,87,0.9)', borderColor: '#FFC857' },
  tierChipText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.75)' },
  tierChipPrice: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF' },
  tierChipStandard: { fontFamily: FontFamily.sora, fontSize: 10, color: 'rgba(255,255,255,0.5)' },
  tierChipTextActive: { color: '#09000F' },
  activationRow: { paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },

  startButton: { backgroundColor: '#F4D77A', borderRadius: BorderRadius.full, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.xs },
  startButtonDisabled: { opacity: 0.6 },
  startButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },

  planCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  planName: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  planDetail: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  subscribeButton: { backgroundColor: 'rgba(255,200,87,0.15)', borderWidth: 1, borderColor: '#FFC857', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  subscribeButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#FFC857' },
});
