import { View, Text, StyleSheet } from 'react-native';
import { SanaaWordmark } from './SanaaWordmark';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

// Production stand-in for the non-subscriber Discovery Home until P2's real
// demo/FAQ/plans content ships. One intentional message, not a screen full
// of "coming soon" placeholder sections -- see SANAA_DISCOVERY_LIVE in
// ownerSanaa.ts. Dev builds skip this entirely and preview the full
// SanaaDiscoveryHome instead.
export function SanaaComingSoon() {
  return (
    <View style={styles.container}>
      <SanaaWordmark width={200} height={70} />
      <Text style={styles.title}>SANAA is on the way</Text>
      <Text style={styles.body}>
        Your AI receptionist is almost ready. We'll let you know the moment she's available to set up.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: '#FFFFFF', marginTop: Spacing.sm, textAlign: 'center' },
  body: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: 300, lineHeight: FontSize.base * 1.5 },
});
