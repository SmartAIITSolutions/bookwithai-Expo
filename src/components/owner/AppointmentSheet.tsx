import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SanaaMark } from '@/components/SanaaMark';
import { OwnerBooking, serviceDisplayName, customerDisplayName } from '@/lib/api/ownerBookings';
import { checkIn, startService, completeService, completeAndReadyForCheckout, cancelBooking, markNoShow, duplicateBooking, setBookingLocked, updateBooking } from '@/lib/api/ownerBookings';
import { getAddOnSuggestion, AddOnSuggestion } from '@/lib/api/ownerServices';
import { bookingStatusColor, nextAction, CheckinFlowMode } from '@/lib/calendar/bookingStatus';
import { isSampleBooking } from '@/lib/calendar/sampleDayFixture';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { formatTimeShort, formatWeekdayMonthDay, formatCentsUSDWhole } from '@/lib/i18n/format';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

interface AppointmentSheetProps {
  booking: OwnerBooking | null;
  onChanged: () => void;
  onReadyForCheckout: () => void;
  flowMode?: CheckinFlowMode;
  // This popup only has room for the fast status actions
  // (check-in/no-show/cancel/etc.) -- reschedule, staff/service changes,
  // direct contact, and notes all live on the full Appointment Detail
  // screen instead. When provided, tapping the customer's name opens it.
  onOpenDetail?: (booking: OwnerBooking) => void;
}

function elapsedLabel(startedAt: string, durationMinutes: number): string {
  const elapsedMin = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000));
  const finish = new Date(new Date(startedAt).getTime() + durationMinutes * 60000);
  const finishLabel = formatTimeShort(finish);
  return i18n.t('owner:appointmentSheet.elapsed', { minutes: elapsedMin, time: finishLabel });
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
  function AppointmentSheet({ booking, onChanged, onReadyForCheckout, flowMode = 'full', onOpenDetail }, ref) {
    const { t } = useTranslation(['owner', 'common']);
    const [working, setWorking] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [confirmNoShow, setConfirmNoShow] = useState(false);
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
    const action = nextAction(booking, flowMode);

    // Correction pass — a sample/demo booking's id doesn't exist in the
    // real bookings table, so every mutation entry point in this sheet
    // (check-in/start/complete/cancel/no-show/restore/lock/duplicate/
    // checkout) needs the same guard move/resize got in TimelineCalendar,
    // for the same reason: showing a real confirm flow that ends in
    // "Booking not found" is a misleading error, not a real one.
    function blockIfSample(): boolean {
      if (!booking || !isSampleBooking(booking.id)) return false;
      Alert.alert(t('owner:appointmentSheet.sampleDataTitle'), t('owner:appointmentSheet.sampleDataMessage'));
      return true;
    }

    async function runAction(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
      if (!booking) return;
      if (blockIfSample()) return;
      setWorking(true);
      const result = await fn(booking.id);
      setWorking(false);
      if (result.ok) onChanged();
      else Alert.alert(t('owner:appointmentSheet.couldNotUpdateTitle'), result.error);
    }

    async function handleCompleteAndCharge() {
      if (!booking) return;
      if (blockIfSample()) return;
      setWorking(true);
      const result = await completeAndReadyForCheckout(booking.id);
      setWorking(false);
      if (result.ok) { onChanged(); onReadyForCheckout(); }
      else Alert.alert(t('owner:appointmentSheet.couldNotUpdateTitle'), result.error);
    }

    function handleActionPress() {
      if (!action) return;
      if (action.key === 'check_in') runAction(checkIn);
      else if (action.key === 'start_service') runAction(startService);
      else if (action.key === 'mark_complete') runAction(completeService);
      else if (action.key === 'complete_and_charge') handleCompleteAndCharge();
      else if (action.key === 'ready_for_checkout') {
        if (blockIfSample()) return;
        onReadyForCheckout();
      }
      else if (action.key === 'book_next_appointment') {
        if (booking?.customer_id) router.push(`/customer/${booking.customer_id}` as never);
      }
    }

    function handleCancel() {
      setMenuOpen(false);
      setConfirmCancel(true);
    }

    function handleNoShow() {
      setMenuOpen(false);
      setConfirmNoShow(true);
    }

    function handleRestore() {
      setMenuOpen(false);
      runAction((id) => updateBooking(id, { status: 'confirmed' }));
    }

    async function handleDuplicate(overrideConflict = false) {
      setMenuOpen(false);
      if (!booking) return;
      if (blockIfSample()) return;
      const nextWeekStart = new Date(new Date(booking.starts_at).getTime() + 7 * 86400000);
      const nextWeekEnd = new Date(new Date(booking.ends_at).getTime() + 7 * 86400000);
      setWorking(true);
      const result = await duplicateBooking(booking.id, nextWeekStart.toISOString(), nextWeekEnd.toISOString(), overrideConflict);
      setWorking(false);
      if (result.ok) {
        Alert.alert(t('owner:appointmentSheet.duplicatedTitle'), t('owner:appointmentSheet.duplicatedMessage', { date: formatWeekdayMonthDay(nextWeekStart) }));
        onChanged();
      } else if (result.code === 'CONFLICT' && !overrideConflict) {
        Alert.alert(
          t('owner:appointmentSheet.timeSlotTakenTitle'),
          t('owner:appointmentSheet.timeSlotTakenMessage', { staffName: booking.staff?.name ?? t('owner:appointmentSheet.thatStaffMember') }),
          [
            { text: t('common:cancel'), style: 'cancel' },
            { text: t('owner:appointmentSheet.doubleBook'), style: 'destructive', onPress: () => handleDuplicate(true) },
          ],
        );
      } else {
        Alert.alert(t('owner:appointmentSheet.couldNotDuplicateTitle'), result.error);
      }
    }

    async function handleToggleLock() {
      setMenuOpen(false);
      if (!booking) return;
      if (blockIfSample()) return;
      setWorking(true);
      const result = await setBookingLocked(booking.id, !booking.locked);
      setWorking(false);
      if (result.ok) onChanged();
      else Alert.alert(t('owner:appointmentSheet.couldNotUpdateTitle'), result.error);
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
            {onOpenDetail ? (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                onPress={() => onOpenDetail(booking)}
              >
                <Text style={styles.customerName}>{customerDisplayName(booking)}</Text>
                {booking.locked && <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.5)" />}
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                <Text style={styles.customerName}>{customerDisplayName(booking)}</Text>
                {booking.locked && <Ionicons name="lock-closed" size={14} color="rgba(255,255,255,0.5)" />}
              </View>
            )}
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
              <TouchableOpacity style={styles.menuItem} onPress={() => handleDuplicate()}>
                <Ionicons name="copy-outline" size={16} color="#FFFFFF" />
                <Text style={styles.menuText}>{t('owner:appointmentSheet.duplicateMenuItem')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={handleToggleLock}>
                <Ionicons name={booking.locked ? 'lock-open-outline' : 'lock-closed-outline'} size={16} color="#FFFFFF" />
                <Text style={styles.menuText}>{booking.locked ? t('owner:appointmentSheet.unlockAppointment') : t('owner:appointmentSheet.lockAppointment')}</Text>
              </TouchableOpacity>
              {booking.status !== 'cancelled' && booking.status !== 'no_show' && booking.status !== 'completed' && (
                <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={handleNoShow}>
                  <Ionicons name="alert-circle-outline" size={16} color="#F09595" />
                  <Text style={[styles.menuText, { color: '#F09595' }]}>{t('owner:appointmentSheet.markNoShow')}</Text>
                </TouchableOpacity>
              )}
              {(booking.status === 'cancelled' || booking.status === 'no_show') && (
                <TouchableOpacity style={[styles.menuItem, styles.menuItemBorder]} onPress={handleRestore}>
                  <Ionicons name="refresh-outline" size={16} color="#4ADE80" />
                  <Text style={[styles.menuText, { color: '#4ADE80' }]}>{t('owner:appointmentSheet.restoreAppointment')}</Text>
                </TouchableOpacity>
              )}
            </BlurView>
          )}

          <Text style={styles.meta}>
            {formatTimeShort(new Date(booking.starts_at))}
            {'  ·  '}{serviceDisplayName(booking)}
            {booking.staff?.name ? `  ·  ${booking.staff.name}` : ''}
          </Text>

          {showElapsed && booking.service?.duration_minutes && (
            <Text style={styles.elapsedText}>{elapsedLabel(booking.service_started_at!, booking.service.duration_minutes)}</Text>
          )}

          {booking.source === 'voice_ai' && (
            <View style={styles.sanaaBadge}>
              <SanaaMark variant="bookingAttribution" />
              <Text style={styles.sanaaBadgeText}>{t('owner:appointmentSheet.bookedBySanaa')}</Text>
            </View>
          )}

          {booking.source === 'rebook_nudge' && (
            <View style={styles.rebookNudgeBadge}>
              <Text style={styles.rebookNudgeBadgeText}>{t('owner:appointmentSheet.rebookNudgeBadge')}</Text>
            </View>
          )}

          {/* Customer's own note for THIS appointment (bookings.notes) --
              distinct from internal_notes below (private staff note, same
              row) and from customer_notes (CRM notes about the customer in
              general, shown on the full Appointment Detail screen instead).
              Shown first since it's what the customer actually asked for
              (allergies, requests, timing) -- the thing most worth reading
              before or while servicing the appointment. Plain text only,
              no markup/link interpretation. */}
          {booking.notes && booking.notes.trim() ? (
            <BlurView intensity={90} tint="dark" style={styles.customerNoteCard}>
              <CardOverlay />
              <Text style={styles.customerNoteLabel}>{t('owner:appointmentSheet.customerNote')}</Text>
              <Text style={styles.notesBody}>{booking.notes}</Text>
            </BlurView>
          ) : null}

          {booking.internal_notes ? (
            <BlurView intensity={90} tint="dark" style={styles.notesCard}>
              <CardOverlay />
              <Text style={styles.notesLabel}>{t('owner:appointmentSheet.salonNotes')}</Text>
              <Text style={styles.notesBody}>{booking.internal_notes}</Text>
            </BlurView>
          ) : null}

          {addOn && (
            <View style={styles.addOnCard}>
              <Text style={styles.addOnText}>
                <Trans
                  ns="owner"
                  i18nKey="appointmentSheet.addOnSuggestion"
                  values={{ pct: addOn.confidence_pct, name: addOn.name, price: formatCentsUSDWhole(addOn.price_cents), minutes: addOn.duration_minutes }}
                  components={{ bold: <Text style={styles.addOnBold} /> }}
                />
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
              <Text style={styles.cancelText}>{t('owner:appointmentSheet.cancelAppointment')}</Text>
            </TouchableOpacity>
          )}
        </BottomSheetView>
        <ConfirmModal
          visible={confirmCancel}
          title={t('owner:appointmentSheet.cancelConfirmTitle')}
          message={t('owner:appointmentSheet.cancelConfirmMessage')}
          cancelLabel={t('owner:appointmentSheet.keepIt')}
          confirmLabel={t('owner:appointmentSheet.cancelAppointment')}
          destructive
          onCancel={() => setConfirmCancel(false)}
          onConfirm={() => { setConfirmCancel(false); runAction(cancelBooking); }}
        />
        <ConfirmModal
          visible={confirmNoShow}
          title={t('owner:appointmentSheet.noShowConfirmTitle')}
          cancelLabel={t('common:cancel')}
          confirmLabel={t('owner:appointmentSheet.markNoShow')}
          destructive
          onCancel={() => setConfirmNoShow(false)}
          onConfirm={() => { setConfirmNoShow(false); runAction((id) => markNoShow(id)); }}
        />
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
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', backgroundColor: 'rgba(123,63,228,0.15)',
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(123,63,228,0.3)',
  },
  sanaaBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#B794F6' },
  rebookNudgeBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(236,72,153,0.15)',
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(236,72,153,0.3)',
  },
  rebookNudgeBadgeText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.xs, color: '#EC4899' },
  notesCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  notesLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, color: '#F4D77A', marginBottom: 4,
  },
  // Deliberately a different accent (blue vs. Salon Notes' gold) so the two
  // cards read as separate concepts at a glance, not just separate labels.
  customerNoteCard: {
    borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(143,184,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  customerNoteLabel: {
    fontFamily: FontFamily.soraSemiBold, fontSize: 11, textTransform: 'uppercase',
    letterSpacing: 0.5, color: '#8FB8FF', marginBottom: 4,
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
