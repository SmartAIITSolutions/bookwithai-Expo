import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SanaaWordmark } from './SanaaWordmark';
import { SanaaLifecycle } from '@/lib/api/ownerSanaa';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const STEPS = ['Configure', 'Connect', 'Test', 'Activate'] as const;

// Setup-in-progress states, in step order -- SANAA-P0/P1-SPEC §11/§12/§22.
// Resumes at the correct incomplete step; already-completed steps never
// have to be repeated.
const STEP_INDEX: Record<string, number> = {
  setup_not_started: 0,
  setup_partial: 1,
  ready_to_test: 2,
  ready_to_activate: 3,
};

const CTA_LABEL: Record<string, string> = {
  setup_not_started: 'Continue Setup',
  setup_partial: 'Continue Setup',
  ready_to_test: 'Test SANAA',
  ready_to_activate: 'Activate SANAA',
};

interface SanaaSetupHomeProps {
  state: SanaaLifecycle;
}

export function SanaaSetupHome({ state }: SanaaSetupHomeProps) {
  const activeStep = STEP_INDEX[state] ?? 0;
  const ctaLabel = CTA_LABEL[state] ?? 'Continue Setup';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <SanaaWordmark width={150} height={53} showTagline={false} />
        <Text style={styles.heroTitle}>Let's Set Her Up</Text>
        <Text style={styles.heroBody}>A few steps and SANAA will be answering your calls.</Text>
      </View>

      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        {STEPS.map((label, i) => {
          const done = i < activeStep;
          const isCurrent = i === activeStep;
          return (
            <View key={label} style={[styles.stepRow, i > 0 && styles.rowBorder]}>
              <View style={[styles.stepBadge, done && styles.stepBadgeDone, isCurrent && styles.stepBadgeCurrent]}>
                {done ? (
                  <Ionicons name="checkmark" size={14} color="#09000F" />
                ) : (
                  <Text style={[styles.stepBadgeText, isCurrent && styles.stepBadgeTextCurrent]}>{i + 1}</Text>
                )}
              </View>
              <Text style={[styles.stepLabel, isCurrent && styles.stepLabelCurrent]}>{label}</Text>
              {isCurrent && <Text style={styles.stepNextTag}>NEXT</Text>}
            </View>
          );
        })}
      </BlurView>

      <Pressable style={styles.primaryCta}>
        <Text style={styles.primaryCtaText}>{ctaLabel}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110, flexGrow: 1 },
  hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  heroTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: '#FFFFFF', marginTop: Spacing.sm },
  heroBody: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeDone: { backgroundColor: '#4ADE80', borderColor: '#4ADE80' },
  stepBadgeCurrent: { backgroundColor: 'rgba(255,200,87,0.15)', borderColor: '#FFC857' },
  stepBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  stepBadgeTextCurrent: { color: '#FFC857' },
  stepLabel: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)' },
  stepLabelCurrent: { fontFamily: FontFamily.soraSemiBold, color: '#FFFFFF' },
  stepNextTag: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 10, letterSpacing: 0.6, color: '#09000F',
    backgroundColor: '#FFC857', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full,
  },
  primaryCta: {
    borderRadius: BorderRadius.full, backgroundColor: '#F4D77A', paddingVertical: 16, alignItems: 'center',
  },
  primaryCtaText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
});
