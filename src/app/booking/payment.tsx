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
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import Reanimated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StripeProvider, useStripe, initStripe } from '@stripe/stripe-react-native';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth/AuthContext';
import { fetchCustomerProfile } from '@/lib/api/customerProfile';
import { formatCentsUSD, formatWeekdayMonthDay, formatTimeShort } from '@/lib/i18n/format';
import i18n from '@/lib/i18n';
import { useTranslation } from 'react-i18next';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const STRIPE_PK = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
const API_BASE  = 'https://bookwithai.app';

const formatPrice = formatCentsUSD;

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr);
  return i18n.t('booking:dateTimeAt', { date: formatWeekdayMonthDay(d), time: formatTimeShort(d) });
}

// Inner component (needs Stripe context)
function PaymentForm({
  stripeAccountId,
  onStripeAccountResolved,
}: {
  stripeAccountId: string | null;
  onStripeAccountResolved: (accountId: string) => void;
}) {
  const { t } = useTranslation(['booking', 'errors']);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  const {
    salonId, salonSlug, salonName,
    serviceIds, serviceNames, totalCents, totalMins,
    staffId, staffName,
    startsAt, endsAt,
    notes, idempotencyKey,
    rebookSource,
  } = useLocalSearchParams<{
    salonId: string; salonSlug: string; salonName: string;
    serviceIds: string; serviceNames: string; totalCents: string; totalMins: string;
    staffId: string; staffName: string;
    startsAt: string; endsAt: string;
    notes: string; idempotencyKey: string;
    rebookSource?: string;
  }>();

  const breatheVal = useSharedValue(0);
  const textSpin = useSharedValue(0);
  useEffect(() => {
    breatheVal.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    const interval = setInterval(() => {
      textSpin.value = withTiming(textSpin.value + 360, {
        duration: 700,
        easing: Easing.inOut(Easing.cubic),
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [breatheVal, textSpin]);
  const payBtnBreatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breatheVal.value * 0.03 }],
  }));
  const payTextSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${textSpin.value}deg` }],
  }));

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chargedCents, setChargedCents] = useState(parseInt(totalCents || '0', 10));
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  // Non-null only when this salon/service has a deposit configured -- the
  // service's real full price, verified server-side from the services
  // table, kept separate from chargedCents (the smaller deposit amount
  // actually charged now) so the booking record still shows its true price.
  const [isDeposit, setIsDeposit] = useState(false);
  const [fullPriceCents, setFullPriceCents] = useState<number | null>(null);
  const [depositRefundPolicyEnabled, setDepositRefundPolicyEnabled] = useState(false);
  const [depositRefundCutoffHours, setDepositRefundCutoffHours] = useState(24);

  const serviceIdList = (serviceIds || '').split(',').filter(Boolean);
  const services = (serviceNames || '').split('||').filter(Boolean);
  const cents = parseInt(totalCents || '0', 10);

  async function fetchPaymentIntent() {
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
      if (!res.ok || !data.client_secret || !data.stripe_account_id) {
        throw new Error(data.error || t('booking:paymentScreen.couldNotSetUpPayment'));
      }

      setChargedCents(data.total_cents ?? cents);
      setPaymentIntentId(data.payment_intent_id);
      setIsDeposit(!!data.is_deposit);
      setFullPriceCents(data.full_price_cents ?? null);
      setDepositRefundPolicyEnabled(!!data.deposit_refund_policy_enabled);
      setDepositRefundCutoffHours(data.deposit_refund_cutoff_hours ?? 24);
      setClientSecret(data.client_secret);
      onStripeAccountResolved(data.stripe_account_id);
    } catch (e: any) {
      setError(e.message || t('booking:paymentScreen.couldNotSetUpPayment'));
      setLoading(false);
    }
  }

  // Phase 1 — fetch the PaymentIntent and hand the connected account id up
  // to <StripeProvider> (this is a direct charge; the SDK must be scoped to
  // the salon's account before initPaymentSheet can use the client_secret).
  useEffect(() => {
    fetchPaymentIntent();
  }, []);

  // Phase 2 — only once <StripeProvider> has been re-rendered with the
  // correct stripeAccountId (the prop coming back down from the parent)
  // is it safe to call initPaymentSheet with this connected-account
  // client_secret.
  useEffect(() => {
    if (!clientSecret || !stripeAccountId) return;
    let cancelled = false;
    (async () => {
      // StripeProvider re-scopes the native SDK in its own useEffect without
      // awaiting it, and React runs this (child) effect before the provider's
      // (parent) effect -- so initPaymentSheet could reach Stripe while the
      // SDK was still on the platform account ("client_secret does not match
      // any associated PaymentIntent on this account"). Scope it explicitly
      // and wait for it first.
      try {
        await initStripe({ publishableKey: STRIPE_PK, stripeAccountId });
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || t('booking:paymentScreen.couldNotSetUpPayment'));
        setLoading(false);
        return;
      }
      if (cancelled) return;
      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: salonName || 'Book With AI',
        googlePay: {
          merchantCountryCode: 'US',
          testEnv: false,
        },
        style: 'alwaysDark',
        appearance: {
          colors: {
            primary: '#F4D77A',
          },
        },
      });
      if (cancelled) return;
      if (initErr) {
        setError(initErr.message || t('booking:paymentScreen.couldNotSetUpPayment'));
      } else {
        setReady(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientSecret, stripeAccountId]);

  async function handlePay() {
    if (!ready) return;
    setPaying(true);
    setError(null);

    try {
      const { error: payErr } = await presentPaymentSheet();
      if (payErr) {
        if (payErr.code !== 'Canceled') {
          notificationError();
          setError(payErr.message || t('booking:paymentScreen.paymentFailed'));
        }
        setPaying(false);
        return;
      }

      // customer_profiles is guaranteed complete by this point -- the
      // profile-completeness gate in _layout.tsx never lets a signed-in
      // customer reach the booking flow without a real phone/email on file,
      // so this replaces the old user_metadata lookup that silently fell
      // back to a fake '0000000000' placeholder phone.
      const profile = user ? await fetchCustomerProfile(user.id) : null;

      // Payment succeeded — create booking via mobile endpoint (no auth required)
      const bookingRes = await fetch(`${API_BASE}/api/mobile/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:         salonId,
          service_ids:       serviceIdList,
          staff_id:          staffId || undefined,
          starts_at:         startsAt,
          ends_at:           endsAt || undefined,
          // The booking's recorded price is always the real full service
          // price, even when a deposit means chargedCents (what Stripe just
          // charged) is smaller -- total_charged_cents on the server is
          // derived from the PaymentIntent itself, not from this value.
          price_cents:       isDeposit && fullPriceCents != null ? fullPriceCents : chargedCents,
          payment_intent_id: paymentIntentId,
          notes:             notes || undefined,
          // Customer identity — sourced from customer_profiles, the
          // canonical cross-salon record collected once at signup.
          customer_name:  user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest',
          customer_email: profile?.email || user?.email || undefined,
          customer_phone: profile?.phone || undefined,
          auth_user_id:   user?.id || undefined,
          idempotency_key: idempotencyKey || undefined,
          source:         rebookSource || undefined,
        }),
      });

      const booking = await bookingRes.json();
      if (!bookingRes.ok) throw new Error(booking.error || t('errors:generic'));

      notificationSuccess();
      router.replace({
        pathname: '/booking/confirmation',
        params: {
          salonId, salonSlug, salonName,
          serviceNames, totalCents: String(chargedCents), totalMins,
          staffName,
          startsAt, endsAt,
          bookingId: booking.id ?? '',
          customerId: booking.customer_id ?? '',
          paid: 'true',
        },
      });
    } catch (e: any) {
      setError(e.message || t('booking:paymentScreen.contactSalonError'));
      setPaying(false);
    }
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F4D77A" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('booking:paymentScreen.title')}</Text>
          {salonName ? <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text> : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Booking summary */}
        <View style={styles.summaryCard}>
          <CardOverlay />
          <Text style={styles.summaryLabel}>{t('booking:paymentScreen.bookingSummary')}</Text>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color="#F4D77A" />
            <Text style={styles.summaryText}>{startsAt ? formatDateTime(startsAt) : '—'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="person-outline" size={16} color="#F4D77A" />
            <Text style={styles.summaryText}>{staffName || t('booking:staffScreen.anyAvailable')}</Text>
          </View>
          {services.map((s, i) => (
            <View key={i} style={styles.summaryRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#F4D77A" />
              <Text style={styles.summaryText}>{s}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {isDeposit ? t('booking:paymentScreen.depositDueNow') : (
                <>{t('booking:paymentScreen.totalLabel')} <Text style={styles.totalNote}>{t('booking:paymentScreen.totalTaxNote')}</Text></>
              )}
            </Text>
            <Text style={styles.totalValue}>{formatPrice(chargedCents)}</Text>
          </View>
          {isDeposit && fullPriceCents != null && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryText}>
                {t('booking:paymentScreen.balanceDueAtAppointment', { amount: formatPrice(fullPriceCents - chargedCents) })}
              </Text>
            </View>
          )}
          {isDeposit && (
            <Text style={styles.depositPolicyText}>
              {depositRefundPolicyEnabled
                ? t('booking:paymentScreen.depositRefundable', { hours: depositRefundCutoffHours })
                : t('booking:paymentScreen.depositRefundBySalon')}
            </Text>
          )}
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#F09595" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Payment info */}
        <View style={styles.infoCard}>
          <Ionicons name="lock-closed-outline" size={18} color="#F4D77A" />
          <Text style={styles.infoText}>
            {t('booking:paymentScreen.securePaymentNote')}
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Pay button */}
      <View style={styles.footer}>
        {loading ? (
          <View style={styles.loadingRow}>
            <BreathingHeart size={18} color="#F4D77A" />
            <Text style={styles.loadingText}>{t('booking:paymentScreen.preparingPayment')}</Text>
          </View>
        ) : (
          <Reanimated.View style={payBtnBreatheStyle}>
            <Pressable
              style={[styles.payBtn, (!ready || paying) && styles.payBtnDisabled]}
              onPress={handlePay}
              disabled={!ready || paying}>
              {paying ? (
                <BreathingHeart size={18} color="#09000F" />
              ) : (
                <Reanimated.View style={[styles.payBtnContent, payTextSpinStyle]}>
                  <Ionicons name="card-outline" size={20} color="#09000F" />
                  <Text style={styles.payBtnText}>
                    {isDeposit
                      ? t('booking:paymentScreen.payDeposit', { amount: formatPrice(chargedCents) })
                      : t('booking:paymentScreen.pay', { amount: formatPrice(chargedCents) })}
                  </Text>
                </Reanimated.View>
              )}
            </Pressable>
          </Reanimated.View>
        )}
      </View>
      </SafeAreaView>
    </View>
  );
}

// Wrap with StripeProvider at this screen level. Direct charge -- the SDK
// must be scoped to the salon's connected account (stripeAccountId), which
// is only known after PaymentForm's initial fetch resolves; it's lifted up
// here so the provider can be re-initialized with the correct account.
export default function PaymentScreen() {
  const [stripeAccountId, setStripeAccountId] = useState<string | null>(null);
  return (
    <StripeProvider publishableKey={STRIPE_PK} stripeAccountId={stripeAccountId ?? undefined}>
      <PaymentForm stripeAccountId={stripeAccountId} onStripeAccountResolved={setStripeAccountId} />
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  headerSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    marginTop: 2,
  },

  scrollContent: { padding: Spacing.md },

  summaryCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    overflow: 'hidden',
  },
  summaryLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(212,175,55,0.7)',
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
    color: '#FFFFFF',
    flex: 1,
  },
  depositPolicyText: {
    fontFamily: FontFamily.sora,
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.xs,
    lineHeight: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.25)',
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
    color: '#FFFFFF',
  },
  totalNote: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs + 2,
    color: 'rgba(255,255,255,0.5)',
  },
  totalValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: '#F4D77A',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(226,74,74,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(226,74,74,0.5)',
    marginBottom: Spacing.md,
  },
  errorText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#F09595',
    flex: 1,
    lineHeight: FontSize.sm * 1.5,
  },

  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  infoText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    flex: 1,
    lineHeight: FontSize.sm * 1.5,
  },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09000F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.25)',
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
    color: '#FFFFFF',
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F4D77A',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  payBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  payBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  payBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#09000F',
  },
});
