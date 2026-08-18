import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SANAA_FAQ_GROUPS } from '@/lib/sanaa/discoveryContent';
import { SanaaFaqAccordion } from './SanaaFaqAccordion';
import { trackSanaaEvent } from '@/lib/analytics/sanaaEvents';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §25-27 -- grouped accordions, no search in V1. Only
// 'approved' items render in production; 'pending' items (whose underlying
// rule isn't locked yet) render __DEV__-only, via SanaaFaqAccordion's own
// visible marker, so they can never be mistaken for approved copy.
export function SanaaFaq() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      {SANAA_FAQ_GROUPS.map((group) => {
        const items = group.items.filter((item) => __DEV__ || item.status === 'approved');
        if (items.length === 0) return null;
        return (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <BlurView intensity={90} tint="dark" style={styles.card}>
              <CardOverlay />
              <View style={styles.itemsWrap}>
                {items.map((item, i) => (
                  <View key={item.question} style={i > 0 ? styles.itemBorder : undefined}>
                    <SanaaFaqAccordion item={item} onExpand={() => trackSanaaEvent('faq_expanded', { question: item.question })} />
                  </View>
                ))}
              </View>
            </BlurView>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  group: { gap: 6 },
  groupTitle: { fontFamily: FontFamily.frauncesSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginLeft: Spacing.xs },
  card: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: Spacing.md,
  },
  itemsWrap: {},
  itemBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
});
