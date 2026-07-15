import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { QRScanner } from '@/components/scanner/QRScanner';

export default function BookScreen() {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>

        {/* Header */}
        <Text style={styles.headline}>Book an Appointment</Text>
        <Text style={styles.subtext}>
          Scan your salon's QR code or open a booking link to get started.
        </Text>

        {/* Scan button */}
        <Pressable
          style={({ pressed }) => [styles.scanBtn, pressed && styles.scanBtnPressed]}
          onPress={() => setScannerOpen(true)}>
          <View style={styles.scanIconWrapper}>
            <Ionicons name="qr-code-outline" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.scanBtnTitle}>Scan QR Code</Text>
          <Text style={styles.scanBtnSub}>Point your camera at the salon's QR code</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Open link hint */}
        <View style={styles.hintCard}>
          <Ionicons name="link-outline" size={20} color={Colors.primary} />
          <Text style={styles.hintText}>
            Open a booking link from a text, email, or the salon's website — the app will open automatically.
          </Text>
        </View>

      </View>

      {/* QR Scanner modal */}
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
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  headline: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtext: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
    marginTop: -Spacing.md,
  },

  // Scan button card
  scanBtn: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  scanBtnPressed: {
    opacity: 0.85,
    borderColor: Colors.primary,
  },
  scanIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.backgroundLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  scanBtnSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },

  // Hint card
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
  },
  hintText: {
    flex: 1,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.6,
  },
});
