import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SANAA_HOW_IT_WORKS_STEPS } from '@/lib/sanaa/discoveryContent';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §20/§21 -- call mechanics only, in plain business language.
// No LLM/model/API/Telnyx/webhook/architecture terms anywhere here.
export function SanaaHowItWorks() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>How SANAA Works</Text>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        {SANAA_HOW_IT_WORKS_STEPS.map((s, i) => (
          <View key={s.step} style={[styles.stepRow, i > 0 && styles.rowBorder]}>
            <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{s.step}</Text></View>
            <Text style={styles.stepLabel}>{s.label}</Text>
          </View>
        ))}
      </BlurView>
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
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,200,87,0.15)',
    borderWidth: 1, borderColor: 'rgba(255,200,87,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#FFC857' },
  stepLabel: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.base, color: '#FFFFFF' },
});
