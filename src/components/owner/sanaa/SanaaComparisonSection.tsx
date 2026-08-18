import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SANAA_COMPARISON_ROWS, SANAA_COMPARISON_APPROVED } from '@/lib/sanaa/discoveryContent';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §19, correction #7: even qualitative claims here (e.g.
// "always available") can become inaccurate depending on uptime, plan
// limits, or phone state -- they need their own explicit approval, separate
// from SANAA_DISCOVERY_LIVE. __DEV__ always previews it for review; a real
// production release additionally requires SANAA_COMPARISON_APPROVED.
export function SanaaComparisonSection() {
  if (!__DEV__ && !SANAA_COMPARISON_APPROVED) return null;

  return (
    <View style={styles.section}>
      {!SANAA_COMPARISON_APPROVED && (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>DEV PREVIEW — claims not yet approved for production</Text>
        </View>
      )}
      <Text style={styles.sectionTitle}>SANAA vs. a Front Desk</Text>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        {SANAA_COMPARISON_ROWS.map((row, i) => (
          <View key={row.dimension} style={[styles.row, i > 0 && styles.rowBorder]}>
            <Text style={styles.dimension}>{row.dimension}</Text>
            <View style={styles.values}>
              <Text style={styles.humanValue}>{row.human}</Text>
              <Text style={styles.sanaaValue}>{row.sanaa}</Text>
            </View>
          </View>
        ))}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  devBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)',
    borderRadius: 10, paddingHorizontal: Spacing.sm, paddingVertical: 6, alignSelf: 'flex-start',
  },
  devBannerText: { fontFamily: FontFamily.soraSemiBold, fontSize: 9.5, color: '#F87171' },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
  },
  row: { paddingVertical: 12, paddingHorizontal: Spacing.md, gap: 4 },
  rowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  dimension: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, letterSpacing: 0.3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' },
  values: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },
  humanValue: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)' },
  sanaaValue: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFC857' },
});
