/**
 * Payment Screen — Step 12
 *
 * Uses @stripe/stripe-react-native PaymentSheet.
 * Run before testing: npx expo install @stripe/stripe-react-native
 *
 * Flow:
 *  1. POST /api/mobile/payment-intent → get client_secret + stripe_account_id
 *  2. initPaymentSheet with those values
 *  3. presentPaymentSheet → user pays
 *  4. POST /api/bookings to create confirmed booking
 *  5. Navigate to /booking/confirmation
 */
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
const API_BASE  = 'https://bookwithai.app';

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}, ${h}:${m} ${ampm}`;
}

// Inner component (needs Stripe context)
function PaymentForm() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const {
    salonId, salonSlug, salonName,
    serviceIds, serviceNames, totalCents, totalMins,
    staffId, staffName,
    startsAt, endsAt,
    notes,
  } = useLocalSearchParams<{
    salonId: string; salonSlug: string; salonName: string;
    serviceIds: string; serviceNames: string; totalCents: string; totalMins: string;
    staffId: string; staffName: string;
    startsAt: string; endsAt: string;
    notes: string;
  }>();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargedCents, setChargedCents] = useState(parseInt(totalCents || '0', 10));
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');

  const serviceIdList = (serviceIds || '').split(',').filter(Boolean);
  const services = (serviceNames || '').split('||').filter(Boolean);
  const cents = parseInt(totalCents || '0', 10);

  useEffect(() => {
    initSheet();
  }, []);

  async function initSheet() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/mobile/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:   salonId,
          service_ids: serviceIdList,
          price_cents: cents,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.client_secret) throw new Error(data.error || 'Failed to prepare payment');

      setChargedCents(data.total_cents ?? cents);
      setStripeAccountId(data.stripe_account_id);
      setPaymentIntentId(data.payment_intent_id);

      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: data.client_secret,
        stripeAccountId: data.stripe_account_id,
        merchantDisplayName: salonName || 'Book With AI',
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: false,
        },
        style: 'automatic',
        appearance: {
          colors: {
            primary: '#5B2EFF',
          },
        },
      });

      if (initErr) throw new Error(initErr.message);
      setReady(true);
    } catch (e: any) {
      setError(e.message || 'Could not set up payment. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePay() {
    if (!ready) return;
    setPaying(true);
    setError(null);

    try {
      const { error: payErr } = await presentPaymentSheet();
      if (payErr) {
        if (payErr.code !== 'Canceled') {
          notificationError();
          setError(payErr.message || 'Payment failed. Please try again.');
        }
        setPaying(false);
        return;
      }

      // Payment succeeded — create booking
      const bookingRes = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:   salonId,
          service_ids: serviceIdList,
          staff_id:    staffId || undefined,
          starts_at:   startsAt,
          source:      'mobile',
          price_cents: chargedCents,
          notes:       notes || undefined,
          payment_intent_id: paymentIntentId,
        }),
      });

      const booking = await bookingRes.json();
      if (!bookingRes.ok) throw new Error(booking.error || 'Booking creation failed');

      notificationSuccess();
      router.replace({
        pathname: '/booking/confirmation',
        params: {
          salonId, salonSlug, salonName,
          serviceNames, totalCents: String(chargedCents), totalMins,
          staffName,
          startsAt, endsAt,
          bookingId: booking.id ?? '',
        },
      });
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please contact the salon.');
      setPaying(false);
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
          <Text style={styles.headerTitle}>Payment</Text>
          {salonName ? <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text> : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Booking Summary</Text>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
            <Text style={styles.summaryText}>{startsAt ? formatDateTime(startsAt) : '—'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="person-outline" size={16} color={Colors.primary} />
            <Text style={styles.summaryText}>{staffName || 'Any Available'}</Text>
          </View>
          {services.map((s, i) => (
            <View key={i} style={styles.summaryRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.success} />
              <Text style={styles.summaryText}>{s}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(chargedCents)}</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Payment info */}
        <View style={styles.infoCard}>
          <Ionicons name="lock-closed-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Payment is processed securely via Stripe. Your card details are never stored.
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Pay button */}
      <View style={styles.footer}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Preparing payment...</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.payBtn, (!ready || paying) && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={!ready || paying}>
            {paying ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color={Colors.white} />
                <Text style={styles.payBtnText}>
                  Pay {formatPrice(chargedCents)}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

// Wrap with StripeProvider at this screen level
export default function PaymentScreen() {
  return (
    <StripeProvider publishableKey={STRIPE_PK}>
      <PaymentForm />
    </StripeProvider>
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

  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.subtle,
  },
  summaryLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  summaryText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.error,
    flex: 1,
    lineHeight: FontSize.sm * 1.5,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: FontSize.sm * 1.5,
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
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  loadingText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.button,
  },
  payBtnDisabled: {
    backgroundColor: Colors.buttonDisabledBg,
  },
  payBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
