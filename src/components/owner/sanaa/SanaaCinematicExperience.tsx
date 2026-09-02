import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

// SANAA-P2-SPEC §7 -- the pain -> solution sequence, built as a restrained
// in-app animated sequence rather than a video file (no video asset exists
// or is being fabricated for this, per §8). Per correction #6: plays once,
// never gates or blocks scrolling (it's just inline content in the
// ScrollView, no "tap to continue"), respects reduced-motion, and doesn't
// auto-loop or replay.
export function SanaaCinematicExperience() {
  const { t } = useTranslation(['sanaa']);
  const BEATS: { icon: keyof typeof Ionicons.glyphMap; caption: string }[] = [
    { icon: 'cut-outline', caption: t('sanaa:cinematic.beat1') },
    { icon: 'call-outline', caption: t('sanaa:cinematic.beat2') },
    { icon: 'hand-left-outline', caption: t('sanaa:cinematic.beat3') },
    { icon: 'sparkles-outline', caption: t('sanaa:cinematic.beat4') },
    { icon: 'checkmark-circle-outline', caption: t('sanaa:cinematic.beat5') },
    { icon: 'calendar-outline', caption: t('sanaa:cinematic.beat6') },
  ];
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  return (
    <BlurView intensity={90} tint="dark" style={styles.card}>
      <CardOverlay />
      <View style={styles.beats}>
        {BEATS.map((beat, i) =>
          reduceMotion ? (
            <View key={beat.caption} style={styles.beatRow}>
              <BeatContent beat={beat} />
            </View>
          ) : (
            <Animated.View key={beat.caption} entering={FadeIn.delay(i * 220).duration(420)} style={styles.beatRow}>
              <BeatContent beat={beat} />
            </Animated.View>
          )
        )}
      </View>
    </BlurView>
  );
}

function BeatContent({ beat }: { beat: { icon: keyof typeof Ionicons.glyphMap; caption: string } }) {
  return (
    <>
      <View style={styles.iconCircle}>
        <Ionicons name={beat.icon} size={18} color="#FFC857" />
      </View>
      <Text style={styles.caption}>{beat.caption}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.lg,
  },
  beats: { gap: Spacing.sm },
  beatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,200,87,0.12)', borderWidth: 1, borderColor: 'rgba(255,200,87,0.3)',
  },
  caption: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.base, color: 'rgba(255,255,255,0.85)' },
});
