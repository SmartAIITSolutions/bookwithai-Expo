import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { OwnerBooking } from '@/lib/api/ownerBookings';
import { checkIn, startService, completeService, cancelBooking, markNoShow, duplicateBooking, setBookingLocked, updateBooking } from '@/lib/api/ownerBookings';
import { getAddOnSuggestion, AddOnSuggestion } from '@/lib/api/ownerServices';
import { bookingStatusColor, nextAction } from '@/lib/calendar/bookingStatus';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface AppointmentSheetProps {
  booking: OwnerBooking | null;
  onChanged: () => void;
  onReadyForCheckout: () => void;
}

function elapsedLabel(startedAt: string, durationMinutes: number): string {
  const elapsedMin = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const finish = new Date(new Date(startedAt).getTime() + durationMinutes * 60000);
  const finishLabel = finish.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `Elapsed ${elapsedMin} min · Est. finish ${finishLabel}`;
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Phase 0.4 — "An appointment is not a record. It's a conversation." The
// calendar stays visible behind this; closing it returns exactly where the
// owner was, no navigation. Rises to ~85% via snapPoints.
export const AppointmentSheet = forwardRef<BottomSheetModal, AppointmentSheetProps>(
  function AppointmentSheet({ booking, onChanged, onReadyForCheckout }, ref) {
    const [working, setWorking] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [addOn, setAddOn] = useState<AddOnSuggestion | null>(null);
    const [, forceTick] = useState(0);
    const snapPoints = useMemo(() => ['85%'], []);

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
      else if (action.label === 'READY FOR CHECKOUT') {
        onReadyForCheckout();
      }
      else if (action.label === 'BOOK NEXT APPOINTMENT') {
        if (booking?.customer_id) router.push(`/customer/${booking.customer_id}` as never);
      }
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
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetView style={styles.container}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={styles.customerName}>{booking.customer?.name ?? 'Customer'}</Text>
              {booking.locked && <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.5)" />}
            </View>
            <View style={[styles.statusPill, { backgroundColor: color }]}>
              <Text style={styles.statusPillText}>{label}</Text>
            </View>
            <TouchableOpacity onPress={() => setMenuOpen(v => !v)} hitSlop={8} style={{ marginLeft: Spacing.xs }}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#F4D77A" />
            </TouchableOpacity>
          </View>

          {menuOpen && (
            <BlurView intensity={90} tint="dark" style={styles.menu}>
              <CardOverlay />
              <TouchableOpacity style={styles.menuItem} onPress={handleDuplicate}>
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                <Text style={styles.menuText}>Duplicate (same time next week)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={handleToggleLock}>
                <Ionicons name={booking.locked ? 'lock-open-outline' : 'lock-closed-outline'} size={16} color="#FFFFFF" />
                <Text style={styles.menuText}>{booking.locked ? 'Unlock' : 'Lock'} appointment</Text>
              </TouchableOpacity>
              {booking.status !== 'cancelled' && booking.status !== 'no_show' && booking.status !== 'completed' && (
                <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={handleNoShow}>
                  <Ionicons name="alert-circle-outline" size={16} color="#F09595" />
                  <Text style={[styles.menuText, { color: '#F09595' }]}>Mark No-Show</Text>
                </TouchableOpacity>
              )}
              {(booking.status === 'cancelled' || booking.status === 'no_show') && (
                <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={handleRestore}>
                  <Ionicons name="refresh-outline" size={16} color="#4ADE80" />
                  <Text style={[styles.menuText, { color: '#4ADE80' }]}>Restore appointment</Text>
                </TouchableOpacity>
              )}
            </BlurView>
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
            <BlurView intensity={90} tint="dark" style={styles.notesCard}>
              <CardOverlay />
              <Text style={styles.notesLabel}>Salon Notes</Text>
              <Text style={styles.notesBody}>{booking.internal_notes}</Text>
            </BlurView>
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
              {working ? <ActivityIndicator color="#09000F" /> : (
                <Text style={styles.actionButtonText}>{action.label}</Text>
              )}
            </TouchableOpacity>
          )}
          {booking.status !== 'cancelled' && booking.status !== 'no_show' && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelRow}>
              <Ionicons name="close-circle-outline" size={16} color="#F09595" />
              <Text style={styles.cancelText}>Cancel appointment</Text>
            </TouchableOpacity>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    );
  }
);

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#0B0712', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl },
  handleIndicator: { backgroundColor: 'rgba(212,175,55,0.4)', width: 40 },
  container: { flex: 1, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customerName: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.lg, color: '#FFFFFF' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusPillText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: 12 },
  menu: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm },
  menuItemBorder: { borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.15)' },
  menuText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  meta: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)' },
  elapsedText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#B794F6' },
  sanaaBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(123,63,228,0.15)',
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(123,63,228,0.3)',
  },
  sanaaBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#B794F6' },
  notesCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  notesLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, color: '#F4D77A', marginBottom: 4,
  },
  notesBody: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },
  addOnCard: {
    backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: BorderRadius.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)',
  },
  addOnText: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)' },
  addOnBold: { fontFamily: FontFamily.soraSemiBold, color: '#F4D77A' },
  spacer: { flex: 1 },
  actionButton: { backgroundColor: '#F4D77A', borderRadius: BorderRadius.lg, paddingVertical: 14, alignItems: 'center' },
  actionButtonDisabled: { backgroundColor: 'rgba(212,175,55,0.3)' },
  actionButtonText: { fontFamily: FontFamily.soraSemiBold, color: '#09000F', fontSize: FontSize.base },
  cancelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: Spacing.md },
  cancelText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F09595' },
});
