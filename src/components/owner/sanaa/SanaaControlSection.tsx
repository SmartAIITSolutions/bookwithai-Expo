import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §22 -- "You're Always in Control." Defensible language
// only: no "never makes mistakes" / "100% accurate" / "completely secure"
// claims anywhere in this component.
export function SanaaControlSection() {
  const { t } = useTranslation(['sanaa']);
  const POINTS = [
    t('sanaa:controlSection.point1'),
    t('sanaa:controlSection.point2'),
    t('sanaa:controlSection.point3'),
    t('sanaa:controlSection.point4'),
    t('sanaa:controlSection.point5'),
  ];
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('sanaa:controlSection.sectionTitle')}</Text>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        {POINTS.map((p, i) => (
          <View key={i} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#FFC857" />
            <Text style={styles.rowText}>{p}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 12, paddingHorizontal: Spacing.md },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  rowText: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', lineHeight: FontSize.sm * 1.4 },
});
