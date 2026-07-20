import { QRScanner } from '@/components/scanner/QRScanner';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { QrCode, Sparkles } from 'lucide-react-native';
import { useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Path,
  RadialGradient,
  Skia,
  vec,
} from '@shopify/react-native-skia';

const COLORS = {
  // Near-black deep plum — the cinematic base
  backgroundTop: '#140A22',
  backgroundMiddle: '#0A0416',
  backgroundBottom: '#040108',
  purple: '#7B3FE4',
  purpleBright: '#B06BFF',
  purpleSoft: '#C7A8FF',
  gold: '#D4AF37',
  goldLight: '#F4D77A',
  white: '#FFFFFF',
  body: 'rgba(255,255,255,0.74)',
  muted: 'rgba(255,255,255,0.52)',
  glass: 'rgba(255,255,255,0.04)',
};

const PLAYFAIR = 'PlayfairDisplay_600SemiBold';
const INTER = 'Inter_400Regular';
const INTER_MEDIUM = 'Inter_500Medium';
const INTER_SEMI = 'Inter_600SemiBold';
const INTER_BOLD = 'Inter_700Bold';

export default function BookScreen() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const cardScale = useRef(new Animated.Value(1)).current;
  const { width, height } = useWindowDimensions();

  const compact = height < 760;
  const contentWidth = Math.min(width - 40, 430);

  function animateCard(toValue: number, speed: number, bounciness: number) {
    Animated.spring(cardScale, {
      toValue,
      useNativeDriver: true,
      speed,
      bounciness,
    }).start();
  }

  function handleGoToSalon() {
    const trimmed = slug.trim();
    if (!trimmed) return;

    const normalized = trimmed
      .replace(/^https?:\/\/(www\.)?bookwithai\.app\/book\//i, '')
      .replace(/^\/+|\/+$/g, '');

    if (!normalized) return;

    router.push({
      pathname: '/salon/[id]',
      params: { id: normalized },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundBottom} />

      <LinearGradient
        colors={[COLORS.backgroundTop, COLORS.backgroundMiddle, COLORS.backgroundBottom]}
        locations={[0, 0.5, 1]}
        style={styles.screen}>
        <BackgroundDecorations />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.scrollContent,
              compact && styles.scrollContentCompact,
            ]}>
            <View style={[styles.content, { width: contentWidth }]}>
              <View style={[styles.titleSection, compact && styles.titleSectionCompact]}>
                <View style={styles.logoWrap}>
                  <Canvas style={styles.logoGlow} pointerEvents="none">
                    <Circle cx={75} cy={75} r={75}>
                      <RadialGradient
                        c={vec(75, 75)}
                        r={75}
                        colors={['rgba(212,175,55,0.16)', 'rgba(212,175,55,0)']}
                      />
                    </Circle>
                  </Canvas>
                  <Text style={[styles.logoLetter, compact && styles.logoLetterCompact]}>
                    B
                  </Text>
                  <Sparkles size={16} color={COLORS.goldLight} style={styles.logoSparkle} />
                </View>

                <Text style={styles.brandTop}>
                  BOOK WITH <Text style={styles.brandAI}>AI</Text>
                </Text>
                <Text style={styles.tagline}>BEAUTY BOOKING. MADE BEAUTIFUL.</Text>

                <Text style={[styles.heading, compact && styles.headingCompact]}>
                  Book an Appointment
                </Text>
                <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
                  Scan your salon&apos;s QR code or open a booking link to get started.
                </Text>
              </View>

              <Animated.View
                style={[styles.cardAnimation, { transform: [{ scale: cardScale }] }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open QR code scanner"
                  onPress={() => setScannerOpen(true)}
                  onPressIn={() => animateCard(0.985, 36, 0)}
                  onPressOut={() => animateCard(1, 28, 3)}>
                  <BlurView
                    intensity={24}
                    tint="dark"
                    style={[styles.qrCard, compact && styles.qrCardCompact]}>
                    <LinearGradient
                      colors={[
                        'rgba(123,63,228,0.12)',
                        'rgba(255,255,255,0.015)',
                        'rgba(212,175,55,0.05)',
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />

                    <View style={styles.goldTopHighlight} />

                    <View style={styles.qrIconOuter}>
                      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Circle cx={50} cy={50} r={65}>
                          <RadialGradient
                            c={vec(50, 50)}
                            r={65}
                            colors={['rgba(176,107,255,0.28)', 'rgba(176,107,255,0)']}
                          />
                        </Circle>
                      </Canvas>
                      <View style={styles.qrIconRing}>
                        <QrCode size={44} color={COLORS.goldLight} strokeWidth={1.7} />
                      </View>
                    </View>

                    <Text style={styles.qrTitle}>Scan QR Code</Text>
                    <Text style={styles.qrDescription}>
                      Point your camera at the salon&apos;s Book With AI code
                    </Text>

                    <View style={styles.scanPill}>
                      <Text style={styles.tapText}>TAP ANYWHERE TO SCAN</Text>
                    </View>
                  </BlurView>
                </Pressable>
              </Animated.View>

              <View style={[styles.dividerRow, compact && styles.dividerRowCompact]}>
                <LinearGradient
                  colors={['transparent', 'rgba(212,175,55,0.4)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.divider}
                />
                <Text style={styles.dividerText}>OR ENTER SALON LINK</Text>
                <LinearGradient
                  colors={['rgba(212,175,55,0.4)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.divider}
                />
              </View>

              <BlurView intensity={18} tint="dark" style={styles.slugCard}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                  style={StyleSheet.absoluteFill}
                />

                <Text style={styles.inputLabel}>Salon booking link</Text>
                <Text style={styles.inputHelper}>
                  Enter the salon name from its Book With AI URL.
                </Text>

                <View style={styles.inputRow}>
                  <TextInput
                    value={slug}
                    onChangeText={setSlug}
                    onSubmitEditing={handleGoToSalon}
                    placeholder="brows-by-tina"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="go"
                    selectionColor={COLORS.goldLight}
                    style={styles.input}
                  />

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open salon booking page"
                    onPress={handleGoToSalon}
                    disabled={!slug.trim()}
                    style={({ pressed }) => [
                      styles.goWrapper,
                      pressed && styles.pressed,
                      !slug.trim() && styles.disabled,
                    ]}>
                    <LinearGradient
                      colors={['#9B5CFF', '#5B2EFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.goButton}>
                      <Text style={styles.goText}>Go</Text>
                    </LinearGradient>
                  </Pressable>
                </View>
              </BlurView>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>

      <Modal
        visible={scannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScannerOpen(false)}>
        <QRScanner onClose={() => setScannerOpen(false)} />
      </Modal>
    </SafeAreaView>
  );
}

function BackgroundDecorations() {
  const { width: W, height: H } = useWindowDimensions();

  const purpleTopArc = Skia.Path.MakeFromSVGString(
    `M ${-W * 0.15} ${H * 0.42} Q ${W * 0.05} ${H * 0.1} ${W * 0.5} ${-H * 0.02}`,
  )!;
  const goldRightArc = Skia.Path.MakeFromSVGString(
    `M ${W * 1.05} ${H * 0.28} Q ${W * 0.78} ${H * 0.55} ${W * 1.02} ${H * 0.88}`,
  )!;
  const purpleBottomArc = Skia.Path.MakeFromSVGString(
    `M ${-W * 0.1} ${H * 0.72} Q ${W * 0.12} ${H * 0.95} ${W * 0.45} ${H * 1.05}`,
  )!;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group>
        <Circle cx={W * 0.1} cy={H * 0.12} r={230}>
          <RadialGradient
            c={vec(W * 0.1, H * 0.12)}
            r={230}
            colors={['rgba(139,74,255,0.35)', 'rgba(139,74,255,0)']}
          />
        </Circle>
        <Circle cx={W * 1.0} cy={H * 0.4} r={210}>
          <RadialGradient
            c={vec(W * 1.0, H * 0.4)}
            r={210}
            colors={['rgba(212,175,55,0.22)', 'rgba(212,175,55,0)']}
          />
        </Circle>
        <Circle cx={W * 0.0} cy={H * 0.9} r={220}>
          <RadialGradient
            c={vec(W * 0.0, H * 0.9)}
            r={220}
            colors={['rgba(123,63,228,0.3)', 'rgba(123,63,228,0)']}
          />
        </Circle>
      </Group>

      <Group>
        <Path path={purpleTopArc} style="stroke" strokeWidth={7} color="rgba(191,132,255,0.85)">
          <BlurMask blur={14} style="normal" />
        </Path>
        <Path path={goldRightArc} style="stroke" strokeWidth={6} color="rgba(244,215,122,0.8)">
          <BlurMask blur={16} style="normal" />
        </Path>
        <Path path={purpleBottomArc} style="stroke" strokeWidth={6} color="rgba(155,92,255,0.7)">
          <BlurMask blur={15} style="normal" />
        </Path>
      </Group>

      <Group>
        <Path path={purpleTopArc} style="stroke" strokeWidth={1.6} color="rgba(230,210,255,0.9)" />
        <Path path={goldRightArc} style="stroke" strokeWidth={1.4} color="rgba(255,240,190,0.9)" />
      </Group>

      <Group>
        {[
          { x: W * 0.82, y: H * 0.24, r: 1.8 },
          { x: W * 0.88, y: H * 0.28, r: 1.2 },
          { x: W * 0.9, y: H * 0.55, r: 1.5 },
          { x: W * 0.12, y: H * 0.82, r: 1.3 },
        ].map((d, i) => (
          <Circle key={i} cx={d.x} cy={d.y} r={d.r} color="rgba(244,215,122,0.9)">
            <BlurMask blur={2} style="normal" />
          </Circle>
        ))}
      </Group>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  safeArea: { flex: 1, backgroundColor: COLORS.backgroundBottom },

  screen: { flex: 1 },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 56,
  },

  scrollContentCompact: { paddingTop: 10, paddingBottom: 44 },

  content: { alignSelf: 'center' },

  titleSection: { alignItems: 'center', marginBottom: 30 },

  titleSectionCompact: { marginBottom: 22 },

  logoWrap: {
    width: 110,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  logoGlow: { position: 'absolute', width: 150, height: 150 },

  logoLetter: {
    color: COLORS.goldLight,
    fontFamily: PLAYFAIR,
    fontSize: 76,
    lineHeight: 84,
  },

  logoLetterCompact: { fontSize: 66, lineHeight: 74 },

  logoSparkle: { position: 'absolute', top: 8, right: 26 },

  brandTop: {
    color: COLORS.white,
    fontFamily: INTER_SEMI,
    fontSize: 17,
    letterSpacing: 4.4,
  },

  brandAI: { color: COLORS.purpleSoft },

  tagline: {
    marginTop: 8,
    color: COLORS.goldLight,
    fontFamily: INTER_BOLD,
    fontSize: 8.2,
    letterSpacing: 1.45,
  },

  heading: {
    marginTop: 24,
    color: COLORS.white,
    fontFamily: PLAYFAIR,
    fontSize: 32,
    lineHeight: 39,
    textAlign: 'center',
  },

  headingCompact: { marginTop: 18, fontSize: 29, lineHeight: 35 },

  subtitle: {
    maxWidth: 330,
    marginTop: 12,
    color: COLORS.body,
    fontFamily: INTER,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'center',
  },

  subtitleCompact: { marginTop: 9, fontSize: 13, lineHeight: 19 },

  cardAnimation: { borderRadius: 30 },

  qrCard: {
    minHeight: 286,
    paddingHorizontal: 24,
    paddingVertical: 30,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.42)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.glass,
  },

  qrCardCompact: { minHeight: 250, paddingVertical: 24 },

  goldTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 56,
    right: 56,
    height: 1,
    backgroundColor: 'rgba(244,215,122,0.9)',
  },

  qrIconOuter: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  qrIconRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(199,168,255,0.5)',
    backgroundColor: 'rgba(10,0,16,0.25)',
  },

  qrTitle: { color: COLORS.white, fontFamily: INTER_BOLD, fontSize: 20 },

  qrDescription: {
    maxWidth: 270,
    marginTop: 9,
    color: COLORS.body,
    fontFamily: INTER,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
  },

  scanPill: {
    marginTop: 17,
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(244,215,122,0.22)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },

  tapText: {
    color: COLORS.goldLight,
    fontFamily: INTER_SEMI,
    fontSize: 9.5,
    letterSpacing: 1,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    paddingHorizontal: 8,
  },

  dividerRowCompact: { marginVertical: 19 },

  divider: { flex: 1, height: 1 },

  dividerText: {
    marginHorizontal: 12,
    color: COLORS.goldLight,
    fontFamily: INTER_SEMI,
    fontSize: 9.5,
    letterSpacing: 0.7,
  },

  slugCard: {
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.34)',
    backgroundColor: COLORS.glass,
  },

  inputLabel: { color: COLORS.white, fontFamily: INTER_BOLD, fontSize: 13 },

  inputHelper: {
    marginTop: 5,
    marginBottom: 13,
    color: COLORS.muted,
    fontFamily: INTER,
    fontSize: 11.5,
    lineHeight: 17,
  },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  input: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(199,168,255,0.3)',
    backgroundColor: 'rgba(5,1,10,0.5)',
    paddingHorizontal: 16,
    color: COLORS.white,
    fontFamily: INTER,
    fontSize: 14,
  },

  goWrapper: { width: 72, height: 54, borderRadius: 15, overflow: 'hidden' },

  goButton: {
    flex: 1,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(244,215,122,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  goText: { color: COLORS.white, fontFamily: INTER_BOLD, fontSize: 15 },

  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },

  disabled: { opacity: 0.42 },
});