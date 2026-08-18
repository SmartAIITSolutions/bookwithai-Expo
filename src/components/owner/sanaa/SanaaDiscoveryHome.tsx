import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SanaaHero } from './SanaaHero';
import { SanaaCinematicExperience } from './SanaaCinematicExperience';
import { SanaaDemoSection } from './SanaaDemoSection';
import { SanaaCapabilities } from './SanaaCapabilities';
import { SanaaHowItWorks } from './SanaaHowItWorks';
import { SanaaControlSection } from './SanaaControlSection';
import { SanaaComparisonSection } from './SanaaComparisonSection';
import { SanaaSetupOptions } from './SanaaSetupOptions';
import { SanaaSocialProof } from './SanaaSocialProof';
import { SanaaFaq } from './SanaaFaq';
import { SanaaSeePlansButton } from './SanaaSeePlansButton';
import { Spacing } from '@/constants/Theme';
import { trackSanaaEvent } from '@/lib/analytics/sanaaEvents';

// Non-subscriber experience -- SANAA-P2-SPEC. Visual rhythm per §33: hero/
// emotion -> cinematic -> demo/proof -> capabilities/information -> how it
// works/clarity -> control/trust -> comparison (dev-gated) -> setup options
// -> social proof (hidden until real) -> FAQ -> conversion. Never a pricing
// table first.
export function SanaaDiscoveryHome() {
  const scrollRef = useRef<ScrollView>(null);
  const trackedOpen = useRef(false);

  useEffect(() => {
    if (!trackedOpen.current) {
      trackedOpen.current = true;
      trackSanaaEvent('discovery_opened');
    }
  }, []);

  function scrollToDemo() {
    // Approximate -- the demo section sits right after the cinematic
    // experience; a fixed offset is simple and good enough for a "See Her
    // in Action" nudge, not a precise scroll-to-element requirement.
    scrollRef.current?.scrollTo({ y: 560, animated: true });
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
      <SanaaHero onExperiencePress={scrollToDemo} />
      <SanaaCinematicExperience />
      <SanaaDemoSection />
      <SanaaCapabilities />
      <SanaaHowItWorks />
      <SanaaControlSection />
      <SanaaComparisonSection />
      <SanaaSetupOptions />
      <SanaaSocialProof />
      <SanaaFaq />
      <SanaaSeePlansButton location="bottom" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: 110 },
});
