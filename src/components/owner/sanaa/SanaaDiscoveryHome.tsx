import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SanaaWordmark } from './SanaaWordmark';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const CAPABILITIES = [
  { icon: 'call-outline' as const, label: 'Answers every call', body: "Never miss a booking because the phone rang during a service." },
  { icon: 'calendar-outline' as const, label: 'Books, reschedules, cancels', body: 'Handles real appointment changes against your live schedule.' },
  { icon: 'help-circle-outline' as const, label: 'Answers salon questions', body: 'Hours, pricing, services -- whatever you tell her to know.' },
  { icon: 'person-outline' as const, label: 'Hands off when needed', body: "Transfers to a real person for anything she shouldn't handle alone." },
];

const HOW_IT_WORKS = [
  { step: '1', label: 'Pick a plan' },
  { step: '2', label: 'Connect your business phone' },
  { step: '3', label: 'Tell her about your salon' },
  { step: '4', label: 'Test a call, then go live' },
];

// Non-subscriber experience -- SANAA-P0/P1-SPEC §9. Sells through
// understanding and experience before price: identity -> demo -> capabilities
// -> how it works -> FAQ -> plans, in that order, never a pricing table first.
// Demo/FAQ/Plans content is intentionally a placeholder boundary, not real
// copy -- final content is a separately-scoped later phase (§10, §25).
export function SanaaDiscoveryHome() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <SanaaWordmark width={180} height={63} />
        <Text style={styles.heroTitle}>Meet SANAA</Text>
        <Text style={styles.heroSubtitle}>Your AI Receptionist</Text>
        <Text style={styles.heroBody}>
          She answers every call, books real appointments, and never puts a customer on hold.
        </Text>
      </View>

      <PlaceholderSection icon="play-circle-outline" title="See SANAA in Action">
        Sample calls and a live trial call are coming here soon.
      </PlaceholderSection>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What She Handles</Text>
        <View style={styles.capabilityGrid}>
          {CAPABILITIES.map((c) => (
            <BlurView key={c.label} intensity={90} tint="dark" style={styles.capabilityCard}>
              <CardOverlay />
              <Ionicons name={c.icon} size={22} color="#FFC857" />
              <Text style={styles.capabilityLabel}>{c.label}</Text>
              <Text style={styles.capabilityBody}>{c.body}</Text>
            </BlurView>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          {HOW_IT_WORKS.map((s, i) => (
            <View key={s.step} style={[styles.stepRow, i > 0 && styles.rowBorder]}>
              <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{s.step}</Text></View>
              <Text style={styles.stepLabel}>{s.label}</Text>
            </View>
          ))}
        </BlurView>
      </View>

      <PlaceholderSection icon="help-circle-outline" title="Frequently Asked Questions">
        Configuration, pricing, and setup answers are coming here soon.
      </PlaceholderSection>

      <View style={styles.section}>
        <Pressable style={styles.primaryCta}>
          <Text style={styles.primaryCtaText}>See Plans</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function PlaceholderSection({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.placeholderCard}>
        <Ionicons name={icon} size={26} color="rgba(255,200,87,0.6)" />
        <Text style={styles.placeholderText}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110 },
  hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  heroTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['3xl'], color: '#FFFFFF', marginTop: Spacing.sm },
  heroSubtitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFC857', letterSpacing: 0.6 },
  heroBody: {
    fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginTop: Spacing.xs, maxWidth: 300, lineHeight: FontSize.base * 1.5,
  },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  placeholderCard: {
    borderRadius: 24, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,200,87,0.35)',
    backgroundColor: 'rgba(0,0,0,0.15)', padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm,
  },
  placeholderText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  capabilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  capabilityCard: {
    width: '48%', borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.md, gap: 6,
  },
  capabilityLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF', marginTop: 2 },
  capabilityBody: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', lineHeight: FontSize.xs * 1.5 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,200,87,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,200,87,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#FFC857' },
  stepLabel: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF' },
  primaryCta: {
    borderRadius: BorderRadius.full, backgroundColor: '#F4D77A', paddingVertical: 16, alignItems: 'center',
  },
  primaryCtaText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
});
