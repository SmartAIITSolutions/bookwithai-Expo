import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SanaaWordmark } from './SanaaWordmark';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface SanaaHeroProps {
  onExperiencePress: () => void;
}

// SANAA-P2-SPEC §5/§6 -- identity, the two locked messages (§2), and one
// primary CTA into the experience. Deliberately no price/plan/feature grid
// here; generous whitespace, not six competing buttons.
export function SanaaHero({ onExperiencePress }: SanaaHeroProps) {
  return (
    <View style={styles.hero}>
      <SanaaWordmark width={180} height={63} />
      <Text style={styles.title}>Meet SANAA</Text>
      <Text style={styles.subtitle}>Your AI Receptionist</Text>
      <Text style={styles.emotional}>
        Take care of the client in your chair.{'\n'}SANAA takes care of the phone.
      </Text>
      <Text style={styles.functional}>
        SANAA is your AI receptionist that answers, books, reschedules, cancels and helps customers.
      </Text>
      <Pressable style={styles.cta} onPress={onExperiencePress}>
        <Text style={styles.ctaText}>See Her in Action</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['3xl'], color: '#FFFFFF', marginTop: Spacing.sm },
  subtitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFC857', letterSpacing: 0.6 },
  emotional: {
    fontFamily: FontFamily.frauncesSemiBold, fontSize: FontSize.lg, color: '#FFFFFF',
    textAlign: 'center', marginTop: Spacing.md, lineHeight: FontSize.lg * 1.4,
  },
  functional: {
    fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.7)',
    textAlign: 'center', marginTop: Spacing.sm, maxWidth: 300, lineHeight: FontSize.base * 1.5,
  },
  cta: {
    marginTop: Spacing.lg, borderRadius: BorderRadius.full, backgroundColor: '#F4D77A',
    paddingHorizontal: Spacing.xl, paddingVertical: 14,
  },
  ctaText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
});
