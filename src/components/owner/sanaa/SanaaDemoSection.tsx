import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SANAA_DEMO_SCENARIOS, SanaaDemoScenarioId } from '@/lib/sanaa/discoveryContent';
import { SanaaDemoScenarioSelector } from './SanaaDemoScenarioSelector';
import { SanaaDemoPlayer } from './SanaaDemoPlayer';
import { SanaaSeePlansButton } from './SanaaSeePlansButton';
import { trackSanaaEvent } from '@/lib/analytics/sanaaEvents';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// SANAA-P2-SPEC §10/§11 -- booking is the hero demo, pre-selected. A hero
// demo player followed by compact scenario selector cards, not six equally
// giant CTAs.
export function SanaaDemoSection() {
  const [selectedId, setSelectedId] = useState<SanaaDemoScenarioId>('booking');
  const scenario = SANAA_DEMO_SCENARIOS.find((s) => s.id === selectedId)!;

  function handleSelect(id: SanaaDemoScenarioId) {
    setSelectedId(id);
    trackSanaaEvent('demo_scenario_selected', { scenario: id });
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>See SANAA in Action</Text>
      <BlurView intensity={90} tint="dark" style={styles.card}>
        <CardOverlay />
        <Text style={styles.scenarioTitle}>{scenario.title}</Text>
        <Text style={styles.scenarioDescription}>{scenario.description}</Text>
        <View style={styles.playerSlot}>
          <SanaaDemoPlayer scenario={scenario} />
        </View>
      </BlurView>
      <SanaaDemoScenarioSelector scenarios={SANAA_DEMO_SCENARIOS} selectedId={selectedId} onSelect={handleSelect} />
      <SanaaSeePlansButton variant="secondary" location="post_demo" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: '#F4D77A', marginLeft: Spacing.xs,
  },
  card: {
    borderRadius: 24, overflow: 'hidden', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)', backgroundColor: 'rgba(0,0,0,0.2)',
    padding: Spacing.lg, gap: 4,
  },
  scenarioTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  scenarioDescription: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginBottom: Spacing.sm },
  playerSlot: { marginTop: Spacing.xs },
});
