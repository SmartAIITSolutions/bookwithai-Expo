import { Pressable, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { FontFamily, FontSize, BorderRadius } from '@/constants/Theme';
import { trackSanaaEvent } from '@/lib/analytics/sanaaEvents';

interface SanaaSeePlansButtonProps {
  variant?: 'primary' | 'secondary';
  location: 'post_demo' | 'bottom';
}

// SANAA-P2-SPEC §28/§29 -- exact locked copy, no urgency language. Shared
// so the post-demo and bottom conversion CTAs stay identical rather than
// drifting apart.
export function SanaaSeePlansButton({ variant = 'primary', location }: SanaaSeePlansButtonProps) {
  return (
    <Pressable
      style={variant === 'primary' ? styles.primary : styles.secondary}
      onPress={() => {
        trackSanaaEvent('see_plans_tapped', { location });
        router.push('/owner-sanaa/plans');
      }}
    >
      <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>See Plans</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: { borderRadius: BorderRadius.full, backgroundColor: '#F4D77A', paddingVertical: 16, alignItems: 'center' },
  primaryText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
  secondary: {
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'rgba(255,200,87,0.5)',
    paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,200,87,0.08)',
  },
  secondaryText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFC857' },
});
