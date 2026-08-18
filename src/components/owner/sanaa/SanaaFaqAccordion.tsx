import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn, FadeOut, LinearTransition, useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';
import { SanaaFaqItem } from '@/lib/sanaa/discoveryContent';

interface SanaaFaqAccordionProps {
  item: SanaaFaqItem;
  onExpand?: () => void;
}

// Reusable expand/collapse item -- no accordion component existed anywhere
// in this app before P2 (confirmed by repo search), so this is built from
// the same react-native-reanimated primitives already used elsewhere
// (LinearTransition animates the surrounding layout as this item grows/
// shrinks, rather than the legacy LayoutAnimation API).
export function SanaaFaqAccordion({ item, onExpand }: SanaaFaqAccordionProps) {
  const [open, setOpen] = useState(false);
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(open ? 1 : 0, { duration: 180 });
  }, [open]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) onExpand?.();
  }

  // 'pending' items only ever reach this component in __DEV__ (SanaaFaq
  // filters them out of production) -- the dev tag below is what keeps
  // them from ever being mistaken for approved, publishable copy.
  return (
    <Animated.View layout={LinearTransition.duration(200)} style={styles.item}>
      <Pressable style={styles.header} onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={styles.question}>{item.question}</Text>
        {item.status === 'pending' && (
          <View style={styles.pendingTag}><Text style={styles.pendingTagText}>DEV — PENDING</Text></View>
        )}
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.5)" />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={styles.answerWrap}>
          <Text style={styles.answer}>{item.answer ?? '(no answer approved yet)'}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  item: { paddingVertical: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 14 },
  question: { flex: 1, fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  pendingTag: { backgroundColor: 'rgba(239,68,68,0.15)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  pendingTagText: { fontFamily: FontFamily.soraSemiBold, fontSize: 8.5, color: '#F87171', letterSpacing: 0.3 },
  answerWrap: { paddingBottom: Spacing.md, paddingRight: Spacing.lg },
  answer: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', lineHeight: FontSize.sm * 1.6 },
});
