/**
 * LegalWebScreen — reusable screen that opens a URL in expo-web-browser.
 * Auto-opens on mount so the user sees the content immediately.
 */
import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

interface Props {
  title: string;
  url: string;
}

export function LegalWebScreen({ title, url }: Props) {
  useEffect(() => {
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#09000F',
      controlsColor: '#F4D77A',
    });
  }, []);

  function handleOpen() {
    WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      toolbarColor: '#09000F',
      controlsColor: '#F4D77A',
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F4D77A" />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.content}>
        <View style={styles.lampWrap}>
          <View style={styles.lampCord} />
          <View style={styles.lampShade} />
        </View>

        <View style={styles.iconWrap}>
          <Canvas style={styles.iconGlow} pointerEvents="none">
            <Circle cx={56} cy={56} r={56}>
              <RadialGradient
                c={vec(56, 56)}
                r={56}
                colors={['rgba(139,92,255,0.30)', 'rgba(244,215,122,0.10)', 'transparent']}
              />
            </Circle>
          </Canvas>
          <View style={styles.iconBadge}>
            <Ionicons name="document-text-outline" size={36} color="#F4D77A" />
          </View>
        </View>

        <Text style={styles.message}>Opening {title}...</Text>
        <Text style={styles.sub}>If the page didn't open, tap below.</Text>
        <Pressable style={({ pressed }) => [styles.openBtn, pressed && { opacity: 0.85 }]} onPress={handleOpen}>
          <Ionicons name="open-outline" size={18} color="#09000F" />
          <Text style={styles.openBtnText}>Open {title}</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.tryAgainBtn, pressed && { opacity: 0.7 }]} onPress={handleOpen}>
          <Ionicons name="refresh-outline" size={14} color="#F4D77A" />
          <Text style={styles.tryAgainText}>Try Again</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09000F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  lampWrap: { alignItems: 'center' },
  lampCord: {
    width: 2,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lampShade: {
    width: 46,
    height: 16,
    backgroundColor: '#15101F',
    borderTopLeftRadius: 23,
    borderTopRightRadius: 23,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(244,215,122,0.7)',
  },
  iconWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
  },
  iconGlow: { position: 'absolute', width: 112, height: 112 },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(20,10,34,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F4D77A',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    ...Shadows.button,
  },
  openBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
  tryAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tryAgainText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#F4D77A',
  },
});
