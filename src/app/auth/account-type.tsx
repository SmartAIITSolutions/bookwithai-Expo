import {
  View, Text, StyleSheet, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function AccountTypeScreen() {
  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>

          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color="#F4D77A" />
            </Pressable>
            <Text style={styles.title}>Let's personalize{'\n'}your experience</Text>
            <View style={styles.backBtn} />
          </View>

          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/auth/sign-up')}>
            <BlurView intensity={90} tint="dark" style={styles.optionCard}>
              <CardOverlay />
              <View style={styles.optionIcon}>
                <Ionicons name="heart-outline" size={26} color="#F4D77A" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>I'm Booking Appointments</Text>
                <Text style={styles.optionDesc}>Discover and book trusted beauty professionals.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
            </BlurView>
          </Pressable>

          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/auth/owner-signup')}>
            <BlurView intensity={90} tint="dark" style={styles.optionCard}>
              <CardOverlay />
              <View style={styles.optionIcon}>
                <Ionicons name="briefcase-outline" size={26} color="#F4D77A" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>I Own a Beauty Business</Text>
                <Text style={styles.optionDesc}>Manage bookings, clients, staff, payments, and grow your business.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
            </BlurView>
          </Pressable>

          <Text style={styles.ownerNote}>
            Set up your business right here in the app — it only takes a few minutes.
          </Text>

          <Pressable style={styles.switchBtn} onPress={() => router.replace('/auth/sign-in')}>
            <Text style={styles.switchText}>Already have an account? <Text style={styles.switchLink}>Sign in</Text></Text>
          </Pressable>

        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { flex: 1, padding: Spacing.xl, gap: Spacing.lg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * 1.25,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 10, alignItems: 'center' },
  optionTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  optionDesc: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: FontSize.base * 1.4,
    textAlign: 'center',
  },

  ownerNote: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.6,
  },

  switchBtn: { alignItems: 'center', marginTop: 'auto' },
  switchText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  switchLink: { color: '#F4D77A', fontFamily: FontFamily.soraSemiBold },
});
