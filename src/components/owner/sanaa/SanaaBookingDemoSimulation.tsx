import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { SanaaDemoOutcome } from './SanaaDemoOutcome';
import { trackSanaaEvent } from '@/lib/analytics/sanaaEvents';

type ScriptLine = { speaker: 'customer' | 'sanaa'; text: string } | { speaker: 'system'; text: string };

const STEP_DELAY_MS = 1100;
const OUTCOME_DELAY_MS = 1400;

export function SanaaBookingDemoSimulation() {
  const { t } = useTranslation(['sanaa']);
  // Purely local, scripted fixture -- no network call, no production data,
  // never presented as a live AI interaction (SANAA-P2-SPEC correction #5).
  // This is the one complete, reviewable demo; the other 5 scenarios stay
  // honestly "unavailable" until real recordings exist (see SanaaDemoPlayer).
  const SCRIPT: ScriptLine[] = [
    { speaker: 'customer', text: t('sanaa:bookingDemo.script1') },
    { speaker: 'system', text: t('sanaa:bookingDemo.script2') },
    { speaker: 'sanaa', text: t('sanaa:bookingDemo.script3') },
    { speaker: 'customer', text: t('sanaa:bookingDemo.script4') },
    { speaker: 'sanaa', text: t('sanaa:bookingDemo.script5') },
  ];
  const [visibleCount, setVisibleCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showOutcome, setShowOutcome] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function play() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setVisibleCount(0);
    setShowOutcome(false);
    setPlaying(true);
    trackSanaaEvent('demo_started', { scenario: 'booking' });

    SCRIPT.forEach((_, i) => {
      const timer = setTimeout(() => setVisibleCount(i + 1), STEP_DELAY_MS * (i + 1));
      timers.current.push(timer);
    });
    const outcomeTimer = setTimeout(() => {
      setShowOutcome(true);
      setPlaying(false);
      trackSanaaEvent('demo_completed', { scenario: 'booking' });
    }, STEP_DELAY_MS * SCRIPT.length + OUTCOME_DELAY_MS);
    timers.current.push(outcomeTimer);
  }

  return (
    <View style={styles.container}>
      <View style={styles.simTag}>
        <Ionicons name="play-circle" size={12} color="#FFC857" />
        <Text style={styles.simTagText}>{t('sanaa:bookingDemo.simulatedDemo')}</Text>
      </View>

      {visibleCount === 0 && !showOutcome ? (
        <Pressable style={styles.playButton} onPress={play}>
          <Ionicons name="play" size={18} color="#09000F" />
          <Text style={styles.playButtonText}>{t('sanaa:bookingDemo.playDemo')}</Text>
        </Pressable>
      ) : (
        <View style={styles.transcript}>
          {SCRIPT.slice(0, visibleCount).map((line, i) => (
            <TranscriptLine key={i} line={line} />
          ))}
        </View>
      )}

      {showOutcome && <SanaaDemoOutcome time={t('sanaa:bookingDemo.demoTime')} service={t('sanaa:bookingDemo.demoService')} />}

      {!playing && (visibleCount > 0 || showOutcome) && (
        <Pressable style={styles.replayButton} onPress={play}>
          <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.6)" />
          <Text style={styles.replayButtonText}>{t('sanaa:bookingDemo.watchAgain')}</Text>
        </Pressable>
      )}
    </View>
  );
}

function TranscriptLine({ line }: { line: ScriptLine }) {
  if (line.speaker === 'system') {
    return (
      <Animated.View entering={FadeIn.duration(250)} style={styles.systemRow}>
        <Text style={styles.systemText}>{line.text}</Text>
      </Animated.View>
    );
  }
  const isSanaa = line.speaker === 'sanaa';
  return (
    <Animated.View entering={FadeIn.duration(250)} style={[styles.bubbleRow, isSanaa && styles.bubbleRowRight]}>
      <View style={[styles.bubble, isSanaa ? styles.bubbleSanaa : styles.bubbleCustomer]}>
        {isSanaa && <Text style={styles.bubbleSpeaker}>SANAA</Text>}
        <Text style={styles.bubbleText}>{line.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.md },
  simTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  simTagText: { fontFamily: FontFamily.soraSemiBold, fontSize: 9.5, letterSpacing: 0.6, color: '#FFC857' },
  playButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: BorderRadius.full, backgroundColor: '#F4D77A', paddingVertical: 14,
  },
  playButtonText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#09000F' },
  transcript: { gap: Spacing.sm, minHeight: 40 },
  systemRow: { alignItems: 'center', paddingVertical: 2 },
  systemText: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.45)', fontStyle: 'italic' },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleCustomer: { backgroundColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 4 },
  bubbleSanaa: { backgroundColor: 'rgba(255,200,87,0.16)', borderWidth: 1, borderColor: 'rgba(255,200,87,0.3)', borderTopRightRadius: 4 },
  bubbleSpeaker: { fontFamily: FontFamily.soraSemiBold, fontSize: 9.5, letterSpacing: 0.5, color: '#FFC857', marginBottom: 2 },
  bubbleText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF', lineHeight: FontSize.sm * 1.4 },
  replayButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  replayButtonText: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)' },
});
