import { QRScanner } from '@/components/scanner/QRScanner';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { QrCode } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
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
  Canvas,
  Circle,
  RadialGradient,
  vec,
} from '@shopify/react-native-skia';

const COLORS = {
  backgroundBottom: '#040108',
  purpleSoft: '#C7A8FF',
  goldLight: '#F4D77A',
  white: '#FFFFFF',
  body: 'rgba(255,255,255,0.74)',
  muted: 'rgba(255,255,255,0.52)',
};

const PLAYFAIR = 'PlayfairDisplay_600SemiBold';
const INTER = 'Inter_400Regular';
const INTER_SEMI = 'Inter_600SemiBold';
const INTER_BOLD = 'Inter_700Bold';

export default function BookScreen() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const cardScale = useRef(new Animated.Value(1)).current;
  const qrBounce = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(qrBounce, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(qrBounce, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [qrBounce]);

  const qrBreatheScale = qrBounce.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

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

      <View style={styles.screen}>
        <DualBreathingBackground />

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
                  <Image
                    source={require('@/assets/images/bwa-gold-logo.png')}
                    style={[styles.logoImage, compact && styles.logoImageCompact]}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.brandTop}>
                  BOOK WITH <Text style={styles.brandAI}>AI</Text>
                </Text>
                <Text style={styles.tagline}>BEAUTY BOOKING. MADE BEAUTIFUL.</Text>
              </View>

              <BlurView intensity={18} tint="dark" style={styles.headingCard}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                  style={StyleSheet.absoluteFill}
                />

                <Text style={[styles.heading, compact && styles.headingCompact]}>
                  Book an Appointment
                </Text>
                <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
                  Scan your salon&apos;s QR code or open a booking link to get started.
                </Text>
              </BlurView>

              <BlurView intensity={90} tint="dark" style={styles.qrMedallionCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                    style={StyleSheet.absoluteFill}
                  />

                  <Animated.View
                    style={{
                      transform: [
                        { scale: cardScale },
                        { scale: qrBreatheScale },
                      ],
                    }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open QR code scanner"
                      onPress={() => setScannerOpen(true)}
                      onPressIn={() => animateCard(0.97, 30, 0)}
                      onPressOut={() => animateCard(1, 22, 4)}
                      style={styles.qrMedallionCircle}>
                      <Canvas style={styles.qrMedallionGlow} pointerEvents="none">
                        <Circle cx={40} cy={40} r={40}>
                          <RadialGradient
                            c={vec(40, 40)}
                            r={40}
                            colors={['rgba(212,175,55,0.28)', 'rgba(123,63,228,0.05)', 'transparent']}
                          />
                        </Circle>
                      </Canvas>

                      <BlurView intensity={22} tint="dark" style={styles.qrMedallionInner}>
                        <QrCode size={18} color={COLORS.goldLight} strokeWidth={1.4} />
                      </BlurView>
                    </Pressable>
                  </Animated.View>

                  <View style={styles.qrScanLabelRow}>
                    <View style={styles.qrScanLine} />
                    <Text style={styles.qrScanTitle}>TAP TO SCAN</Text>
                    <View style={styles.qrScanLine} />
                  </View>
                  <Text style={styles.qrScanDescription}>
                    Point your camera at the salon&apos;s Book With AI code
                  </Text>
                </BlurView>

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

              <BlurView intensity={90} tint="dark" style={styles.slugCard}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                  style={StyleSheet.absoluteFill}
                />

                <Text style={styles.inputLabel}>Salon booking link</Text>
                <Text style={styles.inputHelper}>
                  Enter the salon name from its Book With AI URL.
                </Text>

                <View style={styles.inputRow}>
                  <Animated.View style={{ flex: 1, transform: [{ scale: qrBreatheScale }] }}>
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
                  </Animated.View>

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
      </View>

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

const styles = StyleSheet.create({
  flex: { flex: 1 },

  safeArea: { flex: 1, backgroundColor: COLORS.backgroundBottom },

  screen: { flex: 1 },

  qrMedallionCard: {
    alignItems: 'center',
    marginTop: 20,
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  qrMedallionCircle: {
    width: 63,
    height: 63,
    alignItems: 'center',
    justifyContent: 'center',
  },

  qrMedallionGlow: { position: 'absolute', width: 79, height: 79 },

  qrMedallionInner: {
    width: 49,
    height: 49,
    borderRadius: 24.5,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },

  qrScanLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },

  qrScanLine: {
    width: 20,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.4)',
  },

  qrScanTitle: {
    marginHorizontal: 10,
    color: COLORS.goldLight,
    fontFamily: INTER_SEMI,
    fontSize: 12,
    letterSpacing: 3,
  },

  qrScanDescription: {
    marginTop: 8,
    maxWidth: 260,
    color: COLORS.body,
    fontFamily: INTER,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 9,
    paddingBottom: 56,
  },

  scrollContentCompact: { paddingTop: 5, paddingBottom: 44 },

  content: { alignSelf: 'center' },

  titleSection: { alignItems: 'center', marginBottom: 20, marginTop: -82 },

  titleSectionCompact: { marginBottom: 22, marginTop: -112 },

  logoWrap: {
    width: 372,
    height: 326,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },

  logoGlow: { position: 'absolute', width: 510, height: 510 },

  logoImage: { width: 368, height: 246 },

  logoImageCompact: { width: 312, height: 208 },

  brandTop: {
    color: COLORS.white,
    fontFamily: INTER_BOLD,
    fontSize: 24,
    letterSpacing: 7,
    marginTop: -120,
  },

  brandAI: { color: COLORS.purpleSoft },

  tagline: {
    marginTop: 3,
    color: COLORS.goldLight,
    fontFamily: INTER_BOLD,
    fontSize: 15,
    letterSpacing: 2,
  },

  headingCard: {
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(123,63,228,0.34)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  heading: {
    marginTop: 0,
    color: COLORS.white,
    fontFamily: PLAYFAIR,
    fontSize: 32,
    lineHeight: 39,
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  headingCompact: { marginTop: 0, fontSize: 29, lineHeight: 35 },

  subtitle: {
    maxWidth: 330,
    marginTop: 12,
    color: COLORS.body,
    fontFamily: INTER,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },

  subtitleCompact: { marginTop: 9, fontSize: 13, lineHeight: 19 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingHorizontal: 8,
  },

  dividerRowCompact: { marginVertical: 19 },

  divider: { flex: 1, height: 1 },

  dividerText: {
    marginHorizontal: 12,
    color: COLORS.goldLight,
    fontFamily: INTER_SEMI,
    fontSize: 14.5,
    letterSpacing: 0.7,
  },

  slugCard: {
    marginTop: 0,
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
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
    borderColor: 'rgba(212,175,55,0.2)',
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