import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SanaaDemoScenario, SanaaDemoScenarioId } from '@/lib/sanaa/discoveryContent';

interface SanaaDemoScenarioSelectorProps {
  scenarios: SanaaDemoScenario[];
  selectedId: SanaaDemoScenarioId;
  onSelect: (id: SanaaDemoScenarioId) => void;
}

// Compact chip row, not six giant competing CTAs (SANAA-P2-SPEC §10). Full
// touch-target height for one-handed mobile use (§34).
export function SanaaDemoScenarioSelector({ scenarios, selectedId, onSelect }: SanaaDemoScenarioSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {scenarios.map((s) => {
        const active = s.id === selectedId;
        return (
          <Pressable key={s.id} onPress={() => onSelect(s.id)} style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.title}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: Spacing.md, paddingVertical: 11, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  chipActive: { backgroundColor: 'rgba(255,200,87,0.9)', borderColor: '#FFC857' },
  chipText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)' },
  chipTextActive: { color: '#09000F' },
});
