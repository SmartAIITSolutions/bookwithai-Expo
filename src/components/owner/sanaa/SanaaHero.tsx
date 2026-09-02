import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SanaaWordmark } from './SanaaWordmark';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface SanaaHeroProps {
  onExperiencePress: () => void;
}

// SANAA-P2-SPEC §5/§6 -- identity, the two locked messages (§2), and one
// primary CTA into the experience. Deliberately no price/plan/feature grid
// here; generous whitespace, not six competing buttons.
export function SanaaHero({ onExperiencePress }: SanaaHeroProps) {
  const { t } = useTranslation(['sanaa']);
  return (
    <View style={styles.hero}>
      <SanaaWordmark width={180} height={63} />
      <Text style={styles.title}>{t('sanaa:hero.meetSanaa')}</Text>
      <Text style={styles.subtitle}>{t('sanaa:hero.subtitle')}</Text>
      <Text style={styles.emotional}>
        {t('sanaa:hero.emotional')}
      </Text>
      <Text style={styles.functional}>
        {t('sanaa:hero.functional')}
      </Text>
      <Pressable style={styles.cta} onPress={onExperiencePress}>
        <Text style={styles.ctaText}>{t('sanaa:hero.seeInAction')}</Text>
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
