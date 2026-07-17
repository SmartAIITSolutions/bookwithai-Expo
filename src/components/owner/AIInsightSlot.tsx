import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

// The reserved AI surface every owner-mode screen embeds, per Phase 0.7:
// AI never gets its own tab, icon, or chat bubble — it shows up inside the
// screen it's relevant to, or not at all. Every sprint's screen ships with
// this slot filled by a real (if simple, rule-based) insight — never a
// placeholder that says "AI coming soon."
interface AIInsightSlotProps {
  message: string | null; // null = nothing worth surfacing right now
}

export function AIInsightSlot({ message }: AIInsightSlotProps) {
  if (!message) return null;

  // No icon by design — Phase 0.1 explicitly rules out AI iconography
  // (no robot, no sparkle, no chat bubble). This card is distinguished only
  // by its soft lavender surface, the same way the rest of the app already
  // uses backgroundLavender for gentle emphasis.
  return (
    <View style={styles.card}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.subtle,
  },
  text: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.textPrimary,
    lineHeight: 19,
  },
});
