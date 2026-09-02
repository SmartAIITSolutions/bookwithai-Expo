/**
 * Pay Now Screen — customer self-serve payment for an existing,
 * manually-created booking that was left unpaid at creation time.
 *
 * Flow:
 *  1. Show price breakdown + tip selector (chip pattern ported from
 *     CheckoutSheet.tsx's owner-side Tip section).
 *  2. POST /api/mobile/bookings/[id]/payment-intent → client_secret
 *  3. initPaymentSheet → presentPaymentSheet → user pays
 *  4. POST /api/mobile/bookings/[id]/confirm-payment → booking confirmed
 *  5. Navigate back to My Bookings
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';
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

const formatPrice = formatCentsUSD;

function formatDateTime(isoStr?: string) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return i18n.t('booking:dateTimeAt', { date: formatWeekdayMonthDay(d), time: formatTimeShort(d) });
}

function PayExistingForm() {
  const { t } = useTranslation(['booking', 'common']);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { bookingId, priceCents, salonName, serviceName, startsAt } = useLocalSearchParams<{
    bookingId: string; priceCents: string; salonName: string; serviceName: string; startsAt?: string;
  }>();

  const [price, setPrice] = useState(parseInt(priceCents || '0', 10));
  const [details, setDetails] = useState({ salonName: salonName || '', serviceName: serviceName || '', startsAt: startsAt || '' });
  const [loadingDetails, setLoadingDetails] = useState(!priceCents);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tipCents, setTipCents] = useState(0);
  const [customTip, setCustomTip] = useState(false);
  const [customTipText, setCustomTipText] = useState('');
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tipOptions = [15, 18, 20];

  // Reached via push-notification deep link, only bookingId is passed --
  // fetch the real price/salon/service before letting the customer pay,
  // rather than trusting a possibly-stale/tampered URL param for the amount.
  useEffect(() => {
    if (priceCents) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error(t('booking:payExistingScreen.signInToPay'));
        const res = await fetch(`${API_BASE}/api/mobile/my-bookings`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        const booking = (json.data || []).find((b: any) => b.id === bookingId);
        if (!booking) throw new Error(t('booking:payExistingScreen.bookingNotFound'));
        setPrice(booking.price_cents ?? 0);
        setDetails({
          salonName: booking.agency_clients?.business_name ?? '',
          serviceName: booking.service_names?.join(' + ') ?? booking.services?.name ?? '',
          startsAt: booking.starts_at ?? '',
        });
      } catch (e: any) {
        setLoadError(e.message || t('booking:payExistingScreen.couldNotLoadBooking'));
      } finally {
        setLoadingDetails(false);
      }
    })();
  }, [bookingId, priceCents]);

  async function handlePay() {
    setPaying(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error(t('booking:payExistingScreen.signInToPay'));

      const intentRes = await fetch(`${API_BASE}/api/mobile/bookings/${bookingId}/payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tip_cents: tipCents }),
      });
      const intent = await intentRes.json();
      if (!intentRes.ok || !intent.client_secret) throw new Error(intent.error || t('booking:payExistingScreen.couldNotPreparePayment'));

      const { error: initErr } = await initPaymentSheet({
        paymentIntentClientSecret: intent.client_secret,
        merchantDisplayName: salonName || 'Book With AI',
        googlePay: { merchantCountryCode: 'US', testEnv: false },
        style: 'alwaysDark',
        appearance: { colors: { primary: '#F4D77A' } },
      });
      if (initErr) throw new Error(initErr.message);

      const { error: payErr } = await presentPaymentSheet();
      if (payErr) {
        if (payErr.code !== 'Canceled') {
          notificationError();
          setError(payErr.message || t('booking:payExistingScreen.paymentFailed'));
        }
        setPaying(false);
        return;
      }

      const confirmRes = await fetch(`${API_BASE}/api/mobile/bookings/${bookingId}/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ payment_intent_id: intent.payment_intent_id }),
      });
      const confirm = await confirmRes.json();
      if (!confirmRes.ok) throw new Error(confirm.error || t('booking:payExistingScreen.couldNotConfirmPayment'));

      notificationSuccess();
      Alert.alert(t('booking:payExistingScreen.paymentConfirmedTitle'), t('booking:payExistingScreen.paymentConfirmedMessage'), [
        { text: t('common:ok'), onPress: () => router.replace('/(tabs)/my-booking') },
      ]);
    } catch (e: any) {
      setError(e.message || t('booking:payExistingScreen.contactSalonError'));
      setPaying(false);
    }
  }

  const totalCents = price + tipCents;

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#F4D77A" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{t('booking:payExistingScreen.title')}</Text>
            {details.salonName ? <Text style={styles.headerSub} numberOfLines={1}>{details.salonName}</Text> : null}
          </View>
          <View style={styles.backBtn} />
        </View>

        {loadingDetails ? (
          <View style={styles.loadingRow}>
            <BreathingHeart size={18} color="#F4D77A" />
            <Text style={styles.loadingText}>{t('booking:payExistingScreen.loadingBooking')}</Text>
          </View>
        ) : loadError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#F09595" />
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.summaryCard}>
            <CardOverlay />
            <Text style={styles.summaryLabel}>{t('booking:payExistingScreen.appointmentLabel')}</Text>
            <View style={styles.summaryRow}>
              <Ionicons name="calendar-outline" size={16} color="#F4D77A" />
              <Text style={styles.summaryText}>{formatDateTime(details.startsAt)}</Text>
            </View>
            {details.serviceName ? (
              <View style={styles.summaryRow}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#F4D77A" />
                <Text style={styles.summaryText}>{details.serviceName}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.summaryCard}>
            <CardOverlay />
            <Text style={styles.summaryLabel}>{t('booking:payExistingScreen.addTip')}</Text>
            <View style={styles.chipRow}>
              {tipOptions.map((pct) => {
                const amount = Math.round(price * pct / 100);
                const active = !customTip && tipCents === amount;
                return (
                  <Pressable
                    key={pct}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => { setCustomTip(false); setTipCents(amount); }}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{pct}%</Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.chip, !customTip && tipCents === 0 && styles.chipActive]}
                onPress={() => { setCustomTip(false); setTipCents(0); }}>
                <Text style={[styles.chipText, !customTip && tipCents === 0 && styles.chipTextActive]}>{t('booking:payExistingScreen.none')}</Text>
              </Pressable>
              <Pressable style={[styles.chip, customTip && styles.chipActive]} onPress={() => setCustomTip(true)}>
                <Text style={[styles.chipText, customTip && styles.chipTextActive]}>{t('booking:payExistingScreen.custom')}</Text>
              </Pressable>
            </View>
            {customTip && (
              <TextInput
                style={styles.input}
                placeholder={t('booking:payExistingScreen.tipAmountPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={customTipText}
                onChangeText={(v) => { setCustomTipText(v); setTipCents(Math.round((parseFloat(v) || 0) * 100)); }}
                keyboardType="decimal-pad"
              />
            )}
          </View>

          <View style={styles.summaryCard}>
            <CardOverlay />
            <View style={styles.summaryRow}>
              <Text style={styles.breakdownLabel}>{t('booking:payExistingScreen.service')}</Text>
              <Text style={styles.breakdownValue}>{formatPrice(price)}</Text>
            </View>
            {tipCents > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.breakdownLabel}>{t('booking:payExistingScreen.tip')}</Text>
                <Text style={styles.breakdownValue}>{formatPrice(tipCents)}</Text>
              </View>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('booking:payExistingScreen.totalLabel')}</Text>
              <Text style={styles.totalValue}>{formatPrice(totalCents)}</Text>
            </View>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#F09595" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.infoCard}>
            <Ionicons name="lock-closed-outline" size={18} color="#F4D77A" />
            <Text style={styles.infoText}>
              {t('booking:payExistingScreen.securePaymentNote')}
            </Text>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
        )}

        {!loadingDetails && !loadError && (
        <View style={styles.footer}>
          <Pressable
            style={[styles.payBtn, paying && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={paying}>
            {paying ? (
              <BreathingHeart size={18} color="#09000F" />
            ) : (
              <View style={styles.payBtnContent}>
                <Ionicons name="card-outline" size={20} color="#09000F" />
                <Text style={styles.payBtnText}>{t('booking:payExistingScreen.pay', { amount: formatPrice(totalCents) })}</Text>
              </View>
            )}
          </Pressable>
        </View>
        )}
      </SafeAreaView>
    </View>
  );
}

export default function PayExistingScreen() {
  return (
    <StripeProvider publishableKey={STRIPE_PK}>
      <PayExistingForm />
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

  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

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
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  summaryText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    flex: 1,
  },
  breakdownLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  breakdownValue: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
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
  totalValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: '#F4D77A',
  },

  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  chipActive: { backgroundColor: '#F4D77A', borderColor: '#F4D77A' },
  chipText: { fontFamily: FontFamily.soraSemiBold, fontSize: 12.5, color: '#FFFFFF' },
  chipTextActive: { color: '#09000F' },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    marginTop: Spacing.sm,
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
