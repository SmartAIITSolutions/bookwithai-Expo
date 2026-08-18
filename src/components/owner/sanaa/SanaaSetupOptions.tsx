import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §23 -- two paths, described conceptually. No time claim
// ("10 minutes") in Self Setup copy -- that requires measured onboarding
// evidence we don't have yet. Concierge is purely descriptive: no button,
// no tappable CTA, no price/scope/SLA -- correction #8, it must not look
// bookable until that fulfillment actually exists.
export function SanaaSetupOptions() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Getting Set Up</Text>
      <View style={styles.grid}>
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <Ionicons name="hand-left-outline" size={22} color="#FFC857" />
          <Text style={styles.cardTitle}>Self Setup</Text>
          <Text style={styles.cardBody}>Guided, self-service, no coding required — no need to wait on our team.</Text>
        </BlurView>
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <Ionicons name="sparkles-outline" size={22} color="#FFC857" />
          <Text style={styles.cardTitle}>Concierge Setup</Text>
          <Text style={styles.cardBody}>Prefer help? We can set SANAA up with you. Details coming soon.</Text>
        </BlurView>
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
  grid: { flexDirection: 'row', gap: Spacing.sm },
  card: {
    flex: 1, borderRadius: 20, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.md, gap: 6,
  },
  cardTitle: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#FFFFFF', marginTop: 2 },
  cardBody: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.55)', lineHeight: FontSize.xs * 1.5 },
});
