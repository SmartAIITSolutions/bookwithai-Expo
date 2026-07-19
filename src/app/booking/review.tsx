import { useState, useRef } from 'react';
import * as Crypto from 'expo-crypto';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { API_BASE } from '@/lib/config';

function formatPrice(cents: number) {
  if (!cents) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} at ${h}:${m} ${ampm}`;
}

export default function ReviewScreen() {
  const { user } = useAuth();
  const {
    salonId, salonSlug, salonName, requireOnlinePayment,
    serviceIds, serviceNames, totalCents, totalMins,
    staffId, staffName,
    startsAt, endsAt,
  } = useLocalSearchParams<{
    salonId: string; salonSlug: string; salonName: string; requireOnlinePayment: string;
    serviceIds: string; serviceNames: string; totalCents: string; totalMins: string;
    staffId: string; staffName: string;
    startsAt: string; endsAt: string;
  }>();

  const [notes, setNotes] = useState('');
  const [consented, setConsented] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  // One key per booking attempt at this screen -- reused across retries so a
  // dropped-response retry doesn't create a duplicate booking server-side.
  const idempotencyKey = useRef(Crypto.randomUUID()).current;

  const services = (serviceNames || '').split('||').filter(Boolean);
  const cents = parseInt(totalCents || '0', 10);
  const mins = parseInt(totalMins || '0', 10);

  // Salon doesn't require online payment (or nothing to charge) — skip
  // Stripe entirely and create the booking directly. Salon collects
  // payment in person.
  const skipOnlinePayment = requireOnlinePayment === 'false' || cents === 0;

  async function handleProceed() {
    if (!consented) return;

    if (!skipOnlinePayment) {
      router.push({
        pathname: '/booking/payment',
        params: {
          salonId, salonSlug, salonName,
          serviceIds, serviceNames, totalCents, totalMins,
          staffId, staffName,
          startsAt, endsAt,
          notes,
          idempotencyKey,
        },
      });
      return;
    }

    setBookingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/mobile/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:      salonId,
          service_ids:    (serviceIds || '').split(',').filter(Boolean),
          staff_id:       staffId || undefined,
          starts_at:      startsAt,
          ends_at:        endsAt || undefined,
          price_cents:    cents,
          notes:          notes || undefined,
          customer_name:  user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest',
          customer_email: user?.email || undefined,
          customer_phone: user?.user_metadata?.phone || user?.phone || '0000000000',
          auth_user_id:   user?.id || undefined,
          idempotency_key: idempotencyKey,
        }),
      });

      const booking = await res.json();
      if (!res.ok) throw new Error(booking.error || 'Booking creation failed');

      notificationSuccess();
      router.replace({
        pathname: '/booking/confirmation',
        params: {
          salonId, salonSlug, salonName,
          serviceNames, totalCents, totalMins,
          staffName,
          startsAt, endsAt,
          bookingId: booking.id ?? '',
          customerId: booking.customer_id ?? '',
          paid: 'false',
        },
      });
    } catch (e: any) {
      notificationError();
      Alert.alert('Booking failed', e.message || 'Something went wrong. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Review Booking</Text>
          {salonName ? <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text> : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>

          {/* Date & Time */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Appointment</Text>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
                <Text style={styles.detailText}>{startsAt ? formatDateTime(startsAt) : '—'}</Text>
              </View>
              <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.detailText}>{formatDuration(mins)}</Text>
              </View>
              <View style={[styles.detailRow, { marginTop: Spacing.sm }]}>
                <Ionicons name="person-outline" size={18} color={Colors.primary} />
                <Text style={styles.detailText}>{staffName || 'Any Available'}</Text>
              </View>
            </View>
          </View>

          {/* Services */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Services</Text>
            <View style={styles.detailCard}>
              {services.map((s, i) => (
                <View key={i} style={[styles.detailRow, i > 0 && { marginTop: Spacing.sm }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={Colors.success} />
                  <Text style={styles.detailText}>{s}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Total</Text>
                <Text style={styles.priceValue}>{formatPrice(cents)}</Text>
              </View>
            </View>
          </View>

          {/* Special Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Special Notes (optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Any allergies, preferences, or special requests..."
              placeholderTextColor={Colors.textSecondary}
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
          </View>

          {/* Consent */}
          <Pressable style={styles.consentRow} onPress={() => setConsented(!consented)}>
            <View style={[styles.checkbox, consented && styles.checkboxChecked]}>
              {consented && <Ionicons name="checkmark" size={14} color={Colors.white} />}
            </View>
            <Text style={styles.consentText}>
              I agree to the salon's cancellation and booking policies
            </Text>
          </Pressable>

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.proceedBtn, (!consented || bookingLoading) && styles.proceedBtnDisabled]}
          onPress={handleProceed}
          disabled={!consented || bookingLoading}>
          {bookingLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <>
              <Text style={[styles.proceedBtnText, !consented && styles.proceedBtnTextDisabled]}>
                {skipOnlinePayment
                  ? (cents > 0 ? `Confirm Booking · Pay ${formatPrice(cents)} at Salon` : 'Confirm Booking')
                  : `Proceed to Payment · ${formatPrice(cents)}`}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={consented ? Colors.white : Colors.textDisabled}
              />
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  scrollContent: { padding: Spacing.md },

  section: { marginBottom: Spacing.xl },
  sectionLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },

  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.subtle,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    flex: 1,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  priceValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },

  notesInput: {
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    minHeight: 100,
  },

  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  consentText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: FontSize.sm * 1.6,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 32,
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.button,
  },
  proceedBtnDisabled: {
    backgroundColor: Colors.buttonDisabledBg,
  },
  proceedBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
  proceedBtnTextDisabled: {
    color: Colors.textDisabled,
  },
});
