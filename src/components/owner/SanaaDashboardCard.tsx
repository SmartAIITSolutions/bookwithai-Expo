import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getSanaaStatus, deriveSanaaLifecycle, isSanaaCardDismissed, dismissSanaaCard, SanaaLifecycle } from '@/lib/api/ownerSanaa';
import { useRefetchOnFocus } from '@/hooks/useRefetchOnFocus';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

interface CardContent {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  accent: string;
}

// SANAA-P0/P1-SPEC §6 -- 6 lifecycle-aware content variants (all but
// non-subscriber are placeholders until the phases behind them exist, but
// the card itself must already read correctly for each state so the shell
// is reviewable end to end).
function buildContent(t: ReturnType<typeof useTranslation<['sanaa']>>['t']): Record<SanaaLifecycle, CardContent> {
  return {
    non_subscriber: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.nonSubscriberTitle'),
      body: t('sanaa:dashboardCard.nonSubscriberBody'),
      cta: t('sanaa:dashboardCard.nonSubscriberCta'), accent: '#FFC857',
    },
    setup_not_started: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.setupNotStartedTitle'),
      body: t('sanaa:dashboardCard.setupNotStartedBody'),
      cta: t('sanaa:dashboardCard.continueSetupCta'), accent: '#FFC857',
    },
    setup_partial: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.setupNotStartedTitle'),
      body: t('sanaa:dashboardCard.setupPartialBody'),
      cta: t('sanaa:dashboardCard.continueSetupCta'), accent: '#FFC857',
    },
    ready_to_test: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.readyToTestTitle'),
      body: t('sanaa:dashboardCard.readyToTestBody'),
      cta: t('sanaa:dashboardCard.testSanaaCta'), accent: '#FFC857',
    },
    live: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.liveTitle'),
      body: t('sanaa:dashboardCard.liveBody'),
      cta: t('sanaa:dashboardCard.liveCta'), accent: '#4ADE80',
    },
    paused: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.pausedTitle'),
      body: t('sanaa:dashboardCard.pausedBody'),
      cta: t('sanaa:dashboardCard.resumeCta'), accent: 'rgba(255,255,255,0.6)',
    },
    action_required: {
      eyebrow: 'SANAA', title: t('sanaa:dashboardCard.actionRequiredTitle'),
      body: t('sanaa:dashboardCard.actionRequiredBody'),
      cta: t('sanaa:dashboardCard.fixNowCta'), accent: '#EF4444',
    },
  };
}

export function SanaaDashboardCard() {
  const { t } = useTranslation(['sanaa']);
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    isSanaaCardDismissed().then(setDismissed);
  }, []);

  const { data, refetch } = useQuery({
    queryKey: ['owner-sanaa-status'],
    queryFn: async () => {
      const r = await getSanaaStatus();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });
  // Audit finding — the Dashboard tab stays mounted (not unmounted/remounted)
  // when the owner switches away and back, per useRefetchOnFocus's own
  // comment, so this card's own query only ever fired once per app session
  // with no other trigger to catch it up -- e.g. after resuming SANAA from
  // the SANAA tab and switching back here. Re-validates every time the
  // Dashboard actually regains focus, same as the SANAA screen already does.
  useRefetchOnFocus(refetch);

  if (!data || dismissed === null) return null;
  const lifecycle = deriveSanaaLifecycle(data);

  // A dismissed promotional card only suppresses this non-subscriber
  // nudge -- the permanent SANAA tab is never hidden (§7).
  if (lifecycle === 'non_subscriber' && dismissed) return null;

  const content = buildContent(t)[lifecycle];

  async function handleDismiss() {
    await dismissSanaaCard();
    setDismissed(true);
  }

  return (
    <BlurView intensity={90} tint="dark" style={[styles.card, { borderColor: `${content.accent}80` }]}>
      <CardOverlay />
      {lifecycle === 'non_subscriber' && (
        <TouchableOpacity style={styles.dismissBtn} onPress={handleDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      )}
      <Text style={styles.eyebrow}>{content.eyebrow}</Text>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.body}>{content.body}</Text>
      <TouchableOpacity style={[styles.cta, { backgroundColor: content.accent }]} onPress={() => router.push('/(owner)/sanaa' as never)}>
        <Text style={styles.ctaText}>{content.cta}</Text>
      </TouchableOpacity>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md, gap: 4,
  },
  dismissBtn: { position: 'absolute', top: 12, right: 12, zIndex: 1 },
  eyebrow: { fontFamily: FontFamily.soraSemiBold, fontSize: 11, letterSpacing: 0.8, color: '#F4D77A', textTransform: 'uppercase' },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF', marginTop: 2 },
  body: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  cta: {
    alignSelf: 'flex-start', marginTop: Spacing.sm, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  ctaText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#09000F' },
});
