import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { checkIn, startService, completeService, cancelBooking, markNoShow, duplicateBooking, setBookingLocked, updateBooking } from '@/lib/api/ownerBookings';
import { getAddOnSuggestion, AddOnSuggestion } from '@/lib/api/ownerServices';
import { bookingStatusColor, nextAction } from '@/lib/calendar/bookingStatus';
import { CheckoutSheet } from './CheckoutSheet';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

interface AppointmentSheetProps {
  booking: OwnerBooking | null;
  onChanged: () => void;
}

function elapsedLabel(startedAt: string, durationMinutes: number): string {
  const elapsedMin = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const finish = new Date(new Date(startedAt).getTime() + durationMinutes * 60000);
  const finishLabel = finish.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Elapsed ${elapsedMin} min · Est. finish ${finishLabel}`;
}

// Phase 0.4 — "An appointment is not a record. It's a conversation." The
// calendar stays visible behind this; closing it returns exactly where the
// owner was, no navigation. Rises to ~85% via snapPoints.
export const AppointmentSheet = forwardRef<BottomSheetModal, AppointmentSheetProps>(
  function AppointmentSheet({ booking, onChanged }, ref) {
    const [working, setWorking] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [addOn, setAddOn] = useState<AddOnSuggestion | null>(null);
    const [, forceTick] = useState(0);
    const snapPoints = useMemo(() => ['85%'], []);
    const checkoutRef = useRef<BottomSheetModal>(null);

    const renderBackdrop = useCallback(
      (props: any) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />,
      []
    );

    // Live elapsed timer — re-render every 30s while the sheet is open and
    // service is in progress.
    useEffect(() => {
      if (!booking?.service_started_at || booking.service_completed_at) return;
      const interval = setInterval(() => forceTick(t => t + 1), 30000);
      return () => clearInterval(interval);
    }, [booking?.service_started_at, booking?.service_completed_at]);

    useEffect(() => {
      setAddOn(null);
      if (booking?.service_id) {
        getAddOnSuggestion(booking.service_id).then(r => { if (r.ok) setAddOn(r.data.suggestion); });
      }
    }, [booking?.service_id, booking?.id]);

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
      setMenuOpen(false);
      Alert.alert('Cancel appointment?', 'This cannot be undone.', [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel appointment', style: 'destructive', onPress: () => runAction(cancelBooking) },
      ]);
    }

    function handleNoShow() {
      setMenuOpen(false);
      Alert.alert('Mark as no-show?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark No-Show', style: 'destructive', onPress: () => runAction((id) => markNoShow(id)) },
      ]);
    }

    function handleRestore() {
      setMenuOpen(false);
      runAction((id) => updateBooking(id, { status: 'confirmed' }));
    }

    async function handleDuplicate() {
      setMenuOpen(false);
      if (!booking) return;
      const nextWeekStart = new Date(new Date(booking.starts_at).getTime() + 7 * 86400000);
      const nextWeekEnd = new Date(new Date(booking.ends_at).getTime() + 7 * 86400000);
      setWorking(true);
      const result = await duplicateBooking(booking.id, nextWeekStart.toISOString(), nextWeekEnd.toISOString());
      setWorking(false);
      if (result.ok) {
        Alert.alert('Duplicated', `New appointment created for ${nextWeekStart.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}, same time.`);
        onChanged();
      } else {
        Alert.alert('Could not duplicate', result.error);
      }
    }

    async function handleToggleLock() {
      setMenuOpen(false);
      if (!booking) return;
      setWorking(true);
      const result = await setBookingLocked(booking.id, !booking.locked);
      setWorking(false);
      if (result.ok) onChanged();
      else Alert.alert('Could not update', result.error);
    }

    const showElapsed = booking.service_started_at && !booking.service_completed_at;

    return (
      <BottomSheetModal ref={ref} snapPoints={snapPoints} backdropComponent={renderBackdrop} backgroundStyle={styles.sheetBg}>
        <BottomSheetView style={styles.container}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={styles.customerName}>{booking.customer?.name ?? 'Customer'}</Text>
              {booking.locked && <Ionicons name="lock-closed" size={14} color={Colors.textSecondary} />}
            </View>
            <View style={[styles.statusPill, { backgroundColor: color }]}>
              <Text style={styles.statusPillText}>{label}</Text>
            </View>
            <TouchableOpacity onPress={() => setMenuOpen(v => !v)} hitSlop={8} style={{ marginLeft: Spacing.xs }}>
              <Ionicons name="ellipsis-horizontal" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {menuOpen && (
            <View style={styles.menu}>
              <TouchableOpacity style={styles.menuItem} onPress={handleDuplicate}>
                <Ionicons name="copy-outline" size={16} color={Colors.textPrimary} />
                <Text style={styles.menuText}>Duplicate (same time next week)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={handleToggleLock}>
                <Ionicons name={booking.locked ? 'lock-open-outline' : 'lock-closed-outline'} size={16} color={Colors.textPrimary} />
                <Text style={styles.menuText}>{booking.locked ? 'Unlock' : 'Lock'} appointment</Text>
              </TouchableOpacity>
              {booking.status !== 'cancelled' && booking.status !== 'no_show' && booking.status !== 'completed' && (
                <TouchableOpacity style={styles.menuItem} onPress={handleNoShow}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                  <Text style={[styles.menuText, { color: Colors.error }]}>Mark No-Show</Text>
                </TouchableOpacity>
              )}
              {(booking.status === 'cancelled' || booking.status === 'no_show') && (
                <TouchableOpacity style={styles.menuItem} onPress={handleRestore}>
                  <Ionicons name="refresh-outline" size={16} color={Colors.success} />
                  <Text style={[styles.menuText, { color: Colors.success }]}>Restore appointment</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <Text style={styles.meta}>
            {new Date(booking.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            {'  ·  '}{booking.service?.name ?? 'Service'}
            {booking.staff?.name ? `  ·  ${booking.staff.name}` : ''}
          </Text>

          {showElapsed && booking.service?.duration_minutes && (
            <Text style={styles.elapsedText}>{elapsedLabel(booking.service_started_at!, booking.service.duration_minutes)}</Text>
          )}

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

          {addOn && (
            <View style={styles.addOnCard}>
              <Text style={styles.addOnText}>
                {addOn.confidence_pct}% of customers also get <Text style={styles.addOnBold}>{addOn.name}</Text> — ${(addOn.price_cents / 100).toFixed(0)}, +{addOn.duration_minutes} min
              </Text>
            </View>
          )}

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
  menu: { backgroundColor: Colors.card, borderRadius: BorderRadius.sm, ...Shadows.subtle },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuText: { fontSize: 13.5, color: Colors.textPrimary },
  meta: { fontSize: 14, color: Colors.textSecondary },
  elapsedText: { fontSize: 12.5, color: Colors.statusInService, fontWeight: '600' },
  sanaaBadge: {
    alignSelf: 'flex-start', backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4,
  },
  sanaaBadgeText: { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  notesCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  notesLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: Colors.textSecondary, marginBottom: 4 },
  notesBody: { fontSize: 14, color: Colors.textPrimary },
  addOnCard: { backgroundColor: Colors.backgroundLavender, borderRadius: BorderRadius.sm, padding: Spacing.sm },
  addOnText: { fontSize: 13, color: Colors.textPrimary },
  addOnBold: { fontWeight: '700' },
  spacer: { flex: 1 },
  actionButton: { backgroundColor: Colors.buttonPrimaryBg, borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center', ...Shadows.button },
  actionButtonDisabled: { backgroundColor: Colors.buttonDisabledBg },
  actionButtonText: { color: Colors.buttonPrimaryText, fontSize: 15, fontWeight: '700' },
  cancelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: Spacing.md },
  cancelText: { fontSize: 14, color: Colors.error, fontWeight: '600' },
});
