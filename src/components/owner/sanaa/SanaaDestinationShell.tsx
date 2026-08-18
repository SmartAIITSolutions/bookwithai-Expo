import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

const HEADER_OPTIONS = {
  headerStyle: { backgroundColor: '#0B0712' },
  headerTintColor: '#F4D77A',
  headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
  headerBackTitle: 'SANAA',
};

interface SanaaDestinationShellProps {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  comingFrom: string; // which later phase populates this destination
}

// Shared shell for the four SANAA Operations Home management destinations
// (Calls & Activity, Configure, Phone & Connectivity, Plan & Billing) --
// SANAA-P0/P1-SPEC §14/§26. Real navigable routes with zero invented
// business logic inside, per §25.
export function SanaaDestinationShell({ title, icon, comingFrom }: SanaaDestinationShellProps) {
  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{ ...HEADER_OPTIONS, title }} />
      <View style={styles.centered}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={30} color="#FFC857" />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{comingFrom}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,200,87,0.1)', borderWidth: 1, borderColor: 'rgba(255,200,87,0.3)', marginBottom: Spacing.sm,
  },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: '#FFFFFF', textAlign: 'center' },
  body: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: FontSize.sm * 1.5 },
});
