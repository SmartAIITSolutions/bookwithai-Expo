import { useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  runOnJS,
  cancelAnimation,
} from 'react-native-reanimated';
import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';

const { width, height } = Dimensions.get('window');

// bwa-gold-logo.png's native aspect ratio (matches auth/index.tsx's 330x220 usage).
const LOGO_W = 150;
const LOGO_H = (LOGO_W * 220) / 330;
const GLOW_SIZE = LOGO_W * 2.2;
// Scale needed for the logo to comfortably cover the whole screen at its peak.
const MAX_SCALE = (Math.max(width, height) * 1.5) / LOGO_W;

interface SplashOverlayProps {
  // Flips true once the app has actually decided where to route the user.
  // Until then, the logo keeps growing/glowing and loops if it hits full size.
  ready: boolean;
  onDone: () => void;
}

export function SplashOverlay({ ready, onDone }: SplashOverlayProps) {
  const scale = useSharedValue(0.6);
  const glow = useSharedValue(0.5);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(MAX_SCALE, { duration: 3000, easing: Easing.out(Easing.quad) }),
      -1,
      false
    );
    glow.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    if (!ready) return;
    cancelAnimation(scale);
    scale.value = withTiming(MAX_SCALE * 1.1, { duration: 300 });
    opacity.value = withTiming(0, { duration: 400 }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [ready]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.45 }));

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
      <Animated.View style={[styles.glowWrap, glowStyle]}>
        <Canvas style={styles.glowCanvas}>
          <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2}>
            <RadialGradient
              c={vec(GLOW_SIZE / 2, GLOW_SIZE / 2)}
              r={GLOW_SIZE / 2}
              colors={['rgba(244,215,122,0.5)', 'rgba(244,215,122,0)']}
            />
          </Circle>
        </Canvas>
      </Animated.View>
      <Animated.View style={logoStyle}>
        <Image
          source={require('@/assets/images/bwa-gold-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: '#040108',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  glowWrap: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCanvas: { width: GLOW_SIZE, height: GLOW_SIZE },
  logo: { width: LOGO_W, height: LOGO_H },
});
