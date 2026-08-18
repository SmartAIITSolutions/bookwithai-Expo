import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SANAA_TESTIMONIALS } from '@/lib/sanaa/discoveryContent';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §24 -- only genuine, verifiable social proof is allowed.
// SANAA_TESTIMONIALS is empty until real proof exists; this section renders
// nothing at all in that case, rather than a fake/sample placeholder.
export function SanaaSocialProof() {
  if (SANAA_TESTIMONIALS.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What Salons Are Saying</Text>
      {SANAA_TESTIMONIALS.map((t) => (
        <BlurView key={t.attribution} intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <Text style={styles.quote}>&ldquo;{t.quote}&rdquo;</Text>
          <Text style={styles.attribution}>{t.attribution}</Text>
        </BlurView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.md, gap: 6,
  },
  quote: { fontFamily: FontFamily.frauncesSemiBold, fontSize: FontSize.base, color: '#FFFFFF', lineHeight: FontSize.base * 1.4 },
  attribution: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
});
