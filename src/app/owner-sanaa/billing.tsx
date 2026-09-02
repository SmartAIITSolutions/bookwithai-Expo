import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BreathingHeart } from '@/components/BreathingHeart';
import { ErrorState } from '@/components/ErrorState';
import { getSanaaOffer, SanaaOfferResponse } from '@/lib/api/ownerSanaaOffer';
import { getSanaaUsage, SanaaUsage } from '@/lib/api/ownerSanaaUsage';
import { openSanaaBillingPortal } from '@/lib/api/ownerSanaa';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { formatCentsUSD, formatMonthDay } from '@/lib/i18n/format';

const BILLING_CTA_STATUSES = new Set(['past_due', 'suspended', 'conversion_failed', 'conversion_action_required']);

function formatMoney(cents: number): string {
  return formatCentsUSD(cents);
}

function formatFullDate(iso: string): string {
  return formatMonthDay(new Date(iso));
}

function CardOverlay() {
  return (
    <LinearGradient colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']} style={StyleSheet.absoluteFill} />
  );
}

// Manage-existing destination -- distinct from owner-sanaa/plans (browse/buy).
// Extended (not duplicated) now that a real commercial state exists to show.
export default function SanaaBillingScreen() {
  const { t } = useTranslation(['sanaa']);
  const HEADER_OPTIONS = {
    headerStyle: { backgroundColor: '#0B0712' },
    headerTintColor: '#F4D77A',
    headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
    title: t('sanaa:billingScreen.headerTitle'),
    headerBackTitle: t('sanaa:billingScreen.headerBackTitle'),
  };
  const STATUS_LABEL: Record<string, string> = {
    experience: t('sanaa:billingScreen.statusExperience'),
    active: t('sanaa:billingScreen.statusActive'),
    past_due: t('sanaa:billingScreen.statusPastDue'),
    suspended: t('sanaa:billingScreen.statusSuspended'),
    cancel_scheduled: t('sanaa:billingScreen.statusCancelScheduled'),
    cancelled: t('sanaa:billingScreen.statusCancelled'),
    conversion_failed: t('sanaa:billingScreen.statusConversionFailed'),
    conversion_action_required: t('sanaa:billingScreen.statusConversionActionRequired'),
    converting: t('sanaa:billingScreen.statusConverting'),
    incomplete: t('sanaa:billingScreen.statusIncomplete'),
  };
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [offer, setOffer] = useState<SanaaOfferResponse | null>(null);
  const [usage, setUsage] = useState<SanaaUsage | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [offerResult, usageResult] = await Promise.all([getSanaaOffer(), getSanaaUsage()]);
    if (offerResult.ok) setOffer(offerResult.data);
    else setLoadError(offerResult.error);
    if (usageResult.ok) setUsage(usageResult.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleUpdateBilling() {
    const result = await openSanaaBillingPortal();
    if (result.ok) {
      await WebBrowser.openBrowserAsync(result.data.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });
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
        {offer.current ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sanaa:billingScreen.yourSanaaPlan')}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <Text style={styles.statusText}>{STATUS_LABEL[offer.current.status] ?? offer.current.status}</Text>
              {offer.current.experience_expires_at && offer.current.status === 'experience' && (
                <Text style={styles.hint}>
                  {t('sanaa:billingScreen.experienceEndsHint', { date: formatFullDate(offer.current.experience_expires_at) })}
                </Text>
              )}
              {BILLING_CTA_STATUSES.has(offer.current.status) && (
                <TouchableOpacity style={styles.plansButton} onPress={handleUpdateBilling}>
                  <Text style={styles.plansButtonText}>{t('sanaa:billingScreen.updateBilling')}</Text>
                </TouchableOpacity>
              )}
              {offer.current.status === 'cancelled' && (
                <TouchableOpacity style={styles.plansButton} onPress={() => router.push('/owner-sanaa/plans')}>
                  <Text style={styles.plansButtonText}>{t('sanaa:billingScreen.restartSanaa')}</Text>
                </TouchableOpacity>
              )}
            </BlurView>
          </View>
        ) : null}

        {usage?.available && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('sanaa:billingScreen.usageThisPeriod')}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <Text style={styles.statusText}>{usage.plan_name}</Text>
              <Text style={styles.usagePrice}>{t('sanaa:billingScreen.perMonth', { price: formatMoney(usage.monthly_price_cents) })}</Text>

              <View style={styles.usageRow}>
                <Text style={styles.usageMinutes}>{t('sanaa:billingScreen.minutesUsedOf', { used: usage.used_minutes, included: usage.included_minutes })}</Text>
                <Text style={styles.usagePercent}>{usage.usage_percent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(usage.usage_percent, 100)}%`,
                      backgroundColor: usage.overage_minutes > 0 ? '#F87171' : '#F4D77A',
                    },
                  ]}
                />
              </View>

              {usage.overage_minutes > 0 ? (
                <>
                  <Text style={styles.overageText}>
                    {t('sanaa:billingScreen.usedAdditionalMinutes', { count: usage.overage_minutes })}
                  </Text>
                  <Text style={styles.estimateText}>
                    {t('sanaa:billingScreen.estimatedAdditionalUsage', { amount: formatMoney(usage.estimated_overage_cents) })}
                  </Text>
                  <Text style={styles.overageRateHint}>
                    {t('sanaa:billingScreen.overageRateHint', { rate: formatMoney(usage.overage_rate_cents_per_min) })}
                  </Text>
                </>
              ) : (
                <Text style={styles.remainingText}>
                  {t('sanaa:billingScreen.remainingMinutes', { count: usage.remaining_minutes })}
                </Text>
              )}

              <Text style={styles.cycleLabel}>
                {t('sanaa:billingScreen.billingCycle', { start: formatFullDate(usage.current_period_start), end: formatFullDate(usage.current_period_end) })}
              </Text>
            </BlurView>
          </View>
        )}

        {offer.current ? null : (
          <View style={styles.section}>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <Text style={styles.emptyText}>{t('sanaa:billingScreen.notStartedYet')}</Text>
              <TouchableOpacity style={styles.plansButton} onPress={() => router.push('/owner-sanaa/plans')}>
                <Text style={styles.plansButtonText}>{t('sanaa:billingScreen.seePlans')}</Text>
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
  usagePrice: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  usageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.sm },
  usageMinutes: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  usagePercent: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)' },
  progressTrack: {
    height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  remainingText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)' },
  overageText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F87171' },
  estimateText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },
  overageRateHint: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.45)' },
  cycleLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
  emptyText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  plansButton: {
    alignSelf: 'flex-start', backgroundColor: '#F4D77A', borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 9, marginTop: Spacing.xs,
  },
  plansButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#09000F' },
});
