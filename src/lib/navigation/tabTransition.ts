import { Animated } from 'react-native';

// Shared "arc carousel" tab-switch transition — screens travel the full
// tab-bar width right-to-left, dipping down and tilting slightly at the
// midpoint (an arc rather than a straight line), with a spring for a
// slightly bouncy, cinematic feel. Originally built for the customer
// (tabs) shell; reused as-is for the owner and staff shells so every tab
// bar in the app shares the same transition.
export function makeArcInterpolator(width: number) {
  const dip = 44;
  const tilt = 10;
  return ({ current }: { current: { progress: Animated.Value } }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, -0.6, 0, 0.6, 1],
            outputRange: [-width, -width * 0.55, 0, width * 0.55, width],
          }),
        },
        {
          translateY: current.progress.interpolate({
            inputRange: [-1, -0.6, 0, 0.6, 1],
            outputRange: [0, dip, 0, dip, 0],
          }),
        },
        {
          rotate: current.progress.interpolate({
            inputRange: [-1, -0.6, 0, 0.6, 1],
            outputRange: ['0deg', `-${tilt}deg`, '0deg', `${tilt}deg`, '0deg'],
          }),
        },
        {
          scale: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [0.82, 1, 0.82],
          }),
        },
      ],
    },
  });
}

export const carouselTransitionSpec = {
  animation: 'spring' as const,
  config: {
    stiffness: 220,
    damping: 22,
    mass: 1,
  },
};
