import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

const { width } = Dimensions.get('window');
const FRAME_SIZE = width * 0.68;

interface QRScannerProps {
  onClose: () => void;
}

export function QRScanner({ onClose }: QRScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const debounceRef = useRef(false);

  // Auto-request permission on mount
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  function handleBarCodeScanned({ data }: { data: string }) {
    if (debounceRef.current) return;
    debounceRef.current = true;
    setScanned(true);

    // Extract salon slug from bookwithai.app/book/<slug> or bare slug
    const slug = extractSlug(data);
    if (slug) {
      onClose();
      router.push({ pathname: '/salon/[id]', params: { id: slug } });
    } else {
      // Not a valid BWA link — reset after 2s
      setTimeout(() => {
        debounceRef.current = false;
        setScanned(false);
      }, 2000);
    }
  }

  // ── Permission: not yet determined ─────────────────
  if (!permission) {
    return <View style={styles.container} />;
  }

  // ── Permission: denied ──────────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionBox}>
          <Ionicons name="camera-outline" size={48} color={Colors.primary} />
          <Text style={styles.permTitle}>Camera Access Needed</Text>
          <Text style={styles.permSub}>
            To scan a salon QR code, Book With AI needs access to your camera.
          </Text>
          {permission.canAskAgain ? (
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Allow Camera</Text>
            </Pressable>
          ) : (
            <Text style={styles.permDenied}>
              Camera access was denied. Go to Settings → Book With AI → Camera to enable it.
            </Text>
          )}
          <Pressable onPress={onClose} style={styles.cancelLink}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Camera active ───────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay with cutout */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.frame}>
            {/* Corner marks */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {scanned && (
              <View style={styles.scannedOverlay}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              </View>
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.hint}>Point at a salon's Book With AI QR code</Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function extractSlug(data: string): string | null {
  // Match https://bookwithai.app/book/<slug> or http://bookwithai.app/book/<slug>
  const match = data.match(/bookwithai\.app\/book\/([a-z0-9-]+)/i);
  if (match) return match[1];

  // Bare slug (letters, numbers, hyphens only — no slashes)
  if (/^[a-z0-9-]+$/i.test(data.trim())) return data.trim();

  return null;
}

const OVERLAY_COLOR = 'rgba(0,0,0,0.55)';
const CORNER_SIZE = 24;
const CORNER_THICK = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Permission screen
  permissionBox: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  permTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  permSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },
  permBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  permBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  permDenied: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.6,
    marginTop: Spacing.sm,
  },
  cancelLink: { marginTop: Spacing.md },
  cancelText: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },

  // Camera overlay
  overlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: FRAME_SIZE,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xl,
    paddingBottom: 48,
  },
  hint: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.white,
    opacity: 0.85,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Corner marks
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: Colors.white,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: CORNER_THICK,
    borderLeftWidth: CORNER_THICK,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: CORNER_THICK,
    borderRightWidth: CORNER_THICK,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_THICK,
    borderLeftWidth: CORNER_THICK,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_THICK,
    borderRightWidth: CORNER_THICK,
    borderBottomRightRadius: 4,
  },

  // Scanned success flash
  scannedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
