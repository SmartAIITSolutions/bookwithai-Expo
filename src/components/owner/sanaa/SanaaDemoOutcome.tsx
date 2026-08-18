import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface SanaaDemoOutcomeProps {
  time: string;
  service: string;
}

// SANAA-P2-SPEC §13 -- "show the result inside BWA" after a demo completes.
// Purely a demonstrative visual: a result card plus a small mock calendar
// sliver. No production calendar/booking data is read or written here --
// props are fixture values passed in by whichever demo just finished.
export function SanaaDemoOutcome({ time, service }: SanaaDemoOutcomeProps) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
      <View style={styles.checkCircle}>
        <Ionicons name="checkmark" size={22} color="#09000F" />
      </View>
      <Text style={styles.title}>Appointment Booked</Text>
      <Text style={styles.detail}>{time} · {service}</Text>
      <Text style={styles.sub}>SANAA</Text>

      <View style={styles.calendarSliver}>
        <Text style={styles.calendarLabel}>Book With AI — Demo Calendar</Text>
        <View style={styles.calendarRow}>
          <View style={styles.calendarDot} />
          <Text style={styles.calendarRowText}>{time} · {service}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md },
  checkCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#4ADE80',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
  },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  detail: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFC857' },
  sub: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)' },
  calendarSliver: {
    marginTop: Spacing.md, width: '100%', borderRadius: BorderRadius.lg, borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)', backgroundColor: 'rgba(0,0,0,0.25)', padding: Spacing.md, gap: Spacing.xs,
  },
  calendarLabel: { fontFamily: FontFamily.soraSemiBold, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' },
  calendarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  calendarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  calendarRowText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
});
