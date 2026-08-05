import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel: string;
  destructive?: boolean;
  // Single-button mode -- for plain info notices (e.g. "Copied") that don't
  // need a cancel/confirm choice, just an acknowledgement.
  hideCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Native Alert.alert renders as the OS's own white dialog and can't be
// re-themed -- this is the dark/gold equivalent for confirmations that
// need to visually match the rest of the app (destructive actions like
// cancelling an appointment or marking a no-show, or plain info notices).
export function ConfirmModal({ visible, title, message, cancelLabel = 'Cancel', confirmLabel, destructive, hideCancel, onCancel, onConfirm }: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <BlurView intensity={90} tint="dark" style={styles.card}>
          <CardOverlay />
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
          <View style={[styles.actions, hideCancel && styles.actionsSingle]}>
            {!hideCancel && (
              <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
              <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.65)' },
  card: {
    width: '100%', maxWidth: 340, borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)', backgroundColor: '#0B0712',
    padding: Spacing.lg, gap: Spacing.sm,
  },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  message: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg, marginTop: Spacing.sm },
  actionsSingle: { justifyContent: 'flex-end' },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 4 },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  confirmButton: { paddingVertical: 8, paddingHorizontal: 4 },
  confirmText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  confirmTextDestructive: { color: '#DC2626' },
});
