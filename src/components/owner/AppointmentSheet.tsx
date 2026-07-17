import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { checkIn, startService, completeService, cancelBooking } from '@/lib/api/ownerBookings';
import { bookingStatusColor, nextAction } from '@/lib/calendar/bookingStatus';
import { CheckoutSheet } from './CheckoutSheet';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface AppointmentSheetProps {
  booking: OwnerBooking | null;
  onChanged: () => void;
}

// Phase 0.4 — "An appointment is not a record. It's a conversation." The
// calendar stays visible behind this; closing it returns exactly where the
// owner was, no navigation. Rises to ~85% via snapPoints.
export const AppointmentSheet = forwardRef<BottomSheetModal, AppointmentSheetProps>(
  function AppointmentSheet({ booking, onChanged }, ref) {
    const [working, setWorking] = useState(false);
    const snapPoints = useMemo(() => ['85%'], []);
    const checkoutRef = useRef<BottomSheetModal>(null);

    const renderBackdrop = useCallback(
      (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
      []
    );

    if (!booking) return null;

    const { color, label } = bookingStatusColor(booking);
    const action = nextAction(booking);

    async function runAction(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
      if (!booking) return;
      setWorking(true);
      const result = await fn(booking.id);
      setWorking(false);
      if (result.ok) onChanged();
      else Alert.alert('Could not update', result.error);
    }

    function handleActionPress() {
      if (!action) return;
      if (action.label === 'CHECK IN') runAction(checkIn);
      else if (action.label === 'START SERVICE') runAction(startService);
      else if (action.label === 'MARK SERVICE COMPLETE') runAction(completeService);
      else if (action.label === 'READY FOR CHECKOUT') checkoutRef.current?.present();
      else if (action.label === 'BOOK NEXT APPOINTMENT') {
        if (booking?.customer_id) router.push(`/customer/${booking.customer_id}` as never);
      }
    }

    function handleCheckoutDone() {
      checkoutRef.current?.dismiss();
      onChanged();
    }

    function handleCancel() {
      Alert.alert('Cancel appointment?', 'This cannot be undone.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel appointment', style: 'destructive', onPress: () => runAction(cancelBooking) },
      ]);
    }

    return (
      <BottomSheetModal ref={ref} snapPoints={snapPoints} backdropComponent={renderBackdrop} backgroundStyle={styles.sheetBg}>
        <BottomSheetView style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.customerName}>{booking.customer?.name ?? 'Customer'}</Text>
            <View style={[styles.statusPill, { backgroundColor: color }]}>
              <Text style={styles.statusPillText}>{label}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {new Date(booking.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {'  ·  '}{booking.service?.name ?? 'Service'}
            {booking.staff?.name ? `  ·  ${booking.staff.name}` : ''}
          </Text>

          {booking.source === 'voice_ai' && (
            <View style={styles.sanaaBadge}>
              <Text style={styles.sanaaBadgeText}>Booked by SANAA AI</Text>
            </View>
          )}

          {booking.internal_notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>Salon Notes</Text>
              <Text style={styles.notesBody}>{booking.internal_notes}</Text>
            </View>
          ) : null}

          <View style={styles.spacer} />

          {action && (
            <TouchableOpacity
              style={[styles.actionButton, action.disabled && styles.actionButtonDisabled]}
              onPress={handleActionPress}
              disabled={action.disabled || working}
            >
              {working ? <ActivityIndicator color={Colors.textOnPrimary} /> : (
                <Text style={styles.actionButtonText}>{action.label}</Text>
              )}
            </TouchableOpacity>
          )}
          {booking.status !== 'cancelled' && booking.status !== 'no_show' && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelRow}>
              <Ionicons name="close-circle-outline" size={16} color={Colors.error} />
              <Text style={styles.cancelText}>Cancel appointment</Text>
            </TouchableOpacity>
          )}
        </BottomSheetView>
        <CheckoutSheet ref={checkoutRef} booking={booking} onDone={handleCheckoutDone} />
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: Colors.backgroundMain, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl },
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerName: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 14, color: Colors.textSecondary },
  sanaaBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  sanaaBadgeText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  notesCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  notesLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: Colors.textSecondary, marginBottom: 4 },
  notesBody: { fontSize: 14, color: Colors.textPrimary },
  spacer: { flex: 1 },
  actionButton: { backgroundColor: Colors.buttonPrimaryBg, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', ...Shadows.button },
  actionButtonDisabled: { backgroundColor: Colors.buttonDisabledBg },
  actionButtonText: { color: Colors.buttonPrimaryText, fontSize: 15, fontWeight: '700' },
  disabledHint: { fontSize: 12.5, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xs },
  cancelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: Spacing.md },
  cancelText: { fontSize: 14, color: Colors.error, fontWeight: '600' },
});
