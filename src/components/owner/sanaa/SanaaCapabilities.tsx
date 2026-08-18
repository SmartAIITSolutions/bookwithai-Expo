import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SANAA_CAPABILITIES } from '@/lib/sanaa/discoveryContent';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §17 -- exactly 6 locked categories, concise labels only.
// Not a 30-feature inventory; detailed subclaims belong to P3.
export function SanaaCapabilities() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>What She Handles</Text>
      <View style={styles.grid}>
        {SANAA_CAPABILITIES.map((c) => (
          <BlurView key={c.label} intensity={90} tint="dark" style={styles.card}>
            <CardOverlay />
            <Ionicons name={c.icon as keyof typeof Ionicons.glyphMap} size={22} color="#FFC857" />
            <Text style={styles.label}>{c.label}</Text>
          </BlurView>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: {
    width: '48%', borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.md, gap: 6,
  },
  label: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF', marginTop: 2 },
});
