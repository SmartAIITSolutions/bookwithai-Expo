import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getSanaaStatus, deriveSanaaLifecycle, isSanaaCardDismissed, dismissSanaaCard, SanaaLifecycle } from '@/lib/api/ownerSanaa';
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

// SANAA-P0/P1-SPEC §6 -- 7 lifecycle-aware content variants (all but
// non-subscriber are placeholders until the phases behind them exist, but
// the card itself must already read correctly for each state so the shell
// is reviewable end to end).
const CONTENT: Record<SanaaLifecycle, CardContent> = {
  non_subscriber: {
    eyebrow: 'SANAA', title: 'Your AI Receptionist',
    body: 'She answers every call so you never miss a booking.',
    cta: 'Meet SANAA', accent: '#FFC857',
  },
  setup_not_started: {
    eyebrow: 'SANAA', title: 'Finish Setting Up SANAA',
    body: "You're subscribed -- a few steps left before she can answer calls.",
    cta: 'Continue Setup', accent: '#FFC857',
  },
  setup_partial: {
    eyebrow: 'SANAA', title: 'Finish Setting Up SANAA',
    body: 'Setup is in progress -- pick up where you left off.',
    cta: 'Continue Setup', accent: '#FFC857',
  },
  ready_to_test: {
    eyebrow: 'SANAA', title: 'SANAA Is Almost Ready',
    body: 'Complete your test call before going live.',
    cta: 'Test SANAA', accent: '#FFC857',
  },
  ready_to_activate: {
    eyebrow: 'SANAA', title: 'SANAA Is Ready',
    body: 'Your test call is done -- activate her whenever you are.',
    cta: 'Activate SANAA', accent: '#4ADE80',
  },
  live: {
    eyebrow: 'SANAA', title: '🟢 LIVE — Answering Calls',
    body: "She's on the line whenever you can't be.",
    cta: "View Today's Activity", accent: '#4ADE80',
  },
  paused: {
    eyebrow: 'SANAA', title: 'SANAA Is Paused',
    body: 'SANAA is currently not answering customer calls.',
    cta: 'Resume SANAA', accent: 'rgba(255,255,255,0.6)',
  },
  action_required: {
    eyebrow: 'SANAA', title: 'SANAA Needs Attention',
    body: 'Something needs fixing before she can keep answering calls.',
    cta: 'Fix Now', accent: '#EF4444',
  },
};

export function SanaaDashboardCard() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    isSanaaCardDismissed().then(setDismissed);
  }, []);

  const { data } = useQuery({
    queryKey: ['owner-sanaa-status'],
    queryFn: async () => {
      const r = await getSanaaStatus();
      if (!r.ok) throw new Error(r.error);
      return r.data;
    },
  });

  if (!data || dismissed === null) return null;
  const lifecycle = deriveSanaaLifecycle(data);

  // A dismissed promotional card only suppresses this non-subscriber
  // nudge -- the permanent SANAA tab is never hidden (§7).
  if (lifecycle === 'non_subscriber' && dismissed) return null;

  const content = CONTENT[lifecycle];

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
