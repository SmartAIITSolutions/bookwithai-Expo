import { Image, useWindowDimensions } from 'react-native';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';

// The app-wide ambient background: two copies of the same
// book-screen2-bg.png stacked, each running its own fade-in -> breathe ->
// hold -> fade-out cycle offset by exactly half a period, so the incoming
// layer's fade-in is scheduled to land in the exact same real-time window
// as the outgoing layer's fade-out -- a true crossfade, not a hard cut or
// an abrupt pop-in. There's only one background asset in the project, so
// both layers use it; the effect still reads as motion because only one
// layer is ever fully visible/breathing at a time while the other sits
// hidden at opacity 0.
//
// Both layers derive their phase from a single shared `elapsed` clock fed
// by useFrameCallback, rather than each running its own independent
// withRepeat/withDelay timer. Two separate repeat/delay timers turned out
// to drift apart after a couple of cycles (a real bug -- both layers ended
// up hidden at the same moment, showing a flash of plain black), because
// each timer's start-of-cycle "reset to 0" is re-derived independently.
// A single clock read by both layers every frame can't drift relative to
// itself, so this eliminates that failure mode entirely rather than just
// tuning the timing.
const BREATHE_MS = 5000; // scale ramps 1 -> 1.12 across fade-in + this window
const HOLD_MS = 4000;    // stays fully opaque at full expansion
const FADE_MS = 3000;    // slow crossfade -- this layer's fade-out exactly overlaps the other layer's fade-in
const ACTIVE_MS = BREATHE_MS + HOLD_MS;      // fully-opaque dwell between the two fades
const HALF_PERIOD_MS = ACTIVE_MS + FADE_MS;  // = when this layer starts its own fade-out = when the other layer starts its fade-in
const PERIOD_MS = HALF_PERIOD_MS * 2;

const FADE_IN_END = FADE_MS / PERIOD_MS;               // fade-in: 0 -> 1
const FADE_OUT_START = HALF_PERIOD_MS / PERIOD_MS;     // = 0.5, active dwell ends here
const FADE_OUT_END = (HALF_PERIOD_MS + FADE_MS) / PERIOD_MS; // fade-out: 1 -> 0

// Smoothstep ease -- same start/end instants as a linear ramp, but the rise
// itself eases in instead of climbing at a constant rate, which reads as a
// slower, more natural fade-in rather than a mechanical linear one.
function smoothstep(x: number) {
  'worklet';
  return x * x * (3 - 2 * x);
}

function Layer({ elapsed, phaseOffsetMs, width, height }: {
  elapsed: ReturnType<typeof useSharedValue<number>>;
  phaseOffsetMs: number;
  width: number;
  height: number;
}) {
  const style = useAnimatedStyle(() => {
    // Modulo against a single ever-increasing clock -- recomputed fresh
    // every frame, so there's nothing to drift out of sync.
    const t = ((elapsed.value + phaseOffsetMs) % PERIOD_MS) / PERIOD_MS;

    let opacity: number;
    if (t <= FADE_IN_END) {
      opacity = smoothstep(interpolate(t, [0, FADE_IN_END], [0, 1], Extrapolation.CLAMP));
    } else {
      opacity = interpolate(
        t,
        [FADE_IN_END, FADE_OUT_START, FADE_OUT_END, 1],
        [1, 1, 0, 0],
        Extrapolation.CLAMP
      );
    }
    const scale = interpolate(
      t,
      [0, FADE_OUT_START, FADE_OUT_END, 1],
      [1, 1.6, 1.6, 1],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ scale }] };
  });

  return (
    <Reanimated.View style={[{ position: 'absolute', top: 0, left: 0, width, height, overflow: 'hidden' }, style]}>
      <Image source={require('@/assets/images/book-screen2-bg.png')} style={{ width, height }} resizeMode="contain" />
    </Reanimated.View>
  );
}

export function DualBreathingBackground() {
  const { width, height } = useWindowDimensions();
  const elapsed = useSharedValue(0);

  useFrameCallback((frameInfo) => {
    elapsed.value = frameInfo.timeSinceFirstFrame;
  });

  return (
    <>
      <Layer elapsed={elapsed} phaseOffsetMs={0} width={width} height={height} />
      <Layer elapsed={elapsed} phaseOffsetMs={HALF_PERIOD_MS} width={width} height={height} />
      <Reanimated.View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, width, height, backgroundColor: 'rgba(0,0,0,0.5)' }}
      />
    </>
  );
}
