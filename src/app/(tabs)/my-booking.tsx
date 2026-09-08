import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Alert, Linking, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BreathingHeart } from '@/components/BreathingHeart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { cancelBooking } from '@/lib/api/bookingActions';
import { syncWearRole } from 'wear-bridge';
import { syncCustomerWearData } from '@/lib/wear/syncCustomerWearData';
import { submitBookingReview } from '@/lib/api/customer';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { API_BASE } from '@/lib/config';
import { ErrorState } from '@/components/ErrorState';
import {
  getNotificationPermissionStatus,
  requestAndRegisterPushToken,
} from '@/lib/push/registerForPushNotifications';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import * as Notifications from 'expo-notifications';
import * as ExpoLinking from 'expo-linking';
import Reanimated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { formatCentsUSD, formatWeekdayMonthDay, formatTimeShort } from '@/lib/i18n/format';

const AnimatedLinearGradient = Reanimated.createAnimatedComponent(LinearGradient);

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

function RotatingGoldButton({
  label,
  onPress,
  breathe = true,
}: {
  label: string;
  onPress: () => void;
  breathe?: boolean;
}) {
  const angle = useSharedValue(0);
  const breatheVal = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: 500, easing: Easing.linear }),
      -1,
      false
    );
    breatheVal.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [angle, breatheVal]);

  const animatedProps = useAnimatedProps(() => {
    const rad = (angle.value * Math.PI) / 180;

    return {
      start: { x: 0.5 + 0.5 * Math.cos(rad + Math.PI), y: 0.5 + 0.5 * Math.sin(rad + Math.PI) },
      end: { x: 0.5 + 0.5 * Math.cos(rad), y: 0.5 + 0.5 * Math.sin(rad) },
    };
  });

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breatheVal.value * 0.04 }],
  }));

  return (
    <Pressable
      style={({ pressed }) => [styles.signInBtnGlowWrap, pressed && { opacity: 0.85 }]}
      onPress={onPress}>
      <Reanimated.View style={breathe ? breatheStyle : undefined}>
        <AnimatedLinearGradient
          colors={['#5A2EA8', '#1E1040', '#0D0620']}
          animatedProps={animatedProps}
          style={styles.signInBtn}>
          <View style={styles.signInBtnHighlight} />
          <Text style={styles.signInBtnText}>{label}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ opacity: 0.95 }} />
        </AnimatedLinearGradient>
      </Reanimated.View>
    </Pressable>
  );
}

interface Booking {
  id: string;
  client_id: string;
  customer_id: string | null;
  service_id: string | null;
  staff_id: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  source: string | null;
  price_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  total_charged_cents: number | null;
  deposit_charged_cents: number | null;
  deposit_refund_outcome: 'refunded' | 'forfeited' | null;
  notes: string | null;
  reviewed: boolean;
  review: { stars: number; review_text: string | null } | null;
  agency_clients: {
    business_name: string;
    owner_phone: string | null;
    booking_cutoff_minutes: number | null;
    cancellation_policy: string | null;
    rescheduling_policy: string | null;
    deposit_refund_policy_enabled: boolean | null;
    deposit_refund_cutoff_hours: number | null;
  } | null;
  staff: { id: string; name: string } | null;
  services: { id: string; name: string; duration_minutes: number; buffer_minutes: number | null } | null;
  // Real, complete service list for multi-service bookings (service_id/
  // `services` alone only ever reflect a single service and silently drop
  // the rest). Falls back to [services.name] server-side when there's just
  // one, so this is always the source of truth for display.
  service_names: string[];
}

function serviceDisplayName(item: Pick<Booking, 'service_names' | 'services'>): string {
  if (item.service_names && item.service_names.length > 0) return item.service_names.join(' + ');
  return item.services?.name ?? '';
}

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr);
  return `${formatWeekdayMonthDay(d)} · ${formatTimeShort(d)}`;
}

function statusColor(status: string) {
  switch (status) {
    case 'confirmed': return Colors.success;
    case 'pending':   return Colors.warning;
    case 'cancelled': return Colors.error;
    default:          return 'rgba(255,255,255,0.6)';
  }
}

// Reuses the common:status.* labels already established for the owner-side
// StatusKey vocabulary (see bookingStatus.ts) -- this screen's raw
// `status` values ('confirmed'/'pending'/'cancelled'/'completed'/'no_show')
// are a subset of that same set. Unrecognized/future statuses fall back to
// a simple capitalized display of the raw value rather than crashing or
// showing a blank badge.
function statusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return i18n.t('common:status.confirmed');
    case 'pending':   return i18n.t('common:status.pending');
    case 'cancelled': return i18n.t('common:status.cancelled');
    case 'completed': return i18n.t('common:status.completed');
    case 'no_show':   return i18n.t('common:status.noShow');
    default:          return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

// Minutes between now and the appointment's start — negative once it's passed.
function minutesUntil(startsAt: string): number {
  return (new Date(startsAt).getTime() - Date.now()) / 60000;
}

// Upcoming appointments first (soonest at the very top), then everything
// past/completed after (most recent first) -- not a plain date sort, since
// the API returns newest-starts_at-first regardless of whether it's in the
// future or the past.
function sortBookings(items: Booking[]): Booking[] {
  const now = Date.now();
  const upcoming = items
    .filter((b) => new Date(b.starts_at).getTime() > now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  const past = items
    .filter((b) => new Date(b.starts_at).getTime() <= now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  return [...upcoming, ...past];
}

export default function MyBookingScreen() {
  const { t } = useTranslation(['booking', 'common', 'errors']);
  const { user, loading: authLoading } = useAuth();
  const { highlightBookingId, openRatingBookingId } = useLocalSearchParams<{ highlightBookingId?: string; openRatingBookingId?: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingText, setRatingText] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const openedRatingForDeepLink = useRef<string | null>(null);
  const [notifPermissionGranted, setNotifPermissionGranted] = useState(true);
  const listRef = useRef<ScrollView>(null);
  const rowYPositions = useRef<Record<string, number>>({});
  const cardBounce = useSharedValue(0);

  useEffect(() => {
    cardBounce.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [cardBounce]);

  const cardBounceStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + cardBounce.value * 0.06 },
      { translateY: -cardBounce.value * 8 },
    ],
  }));

  useFocusEffect(
    useCallback(() => {
      getNotificationPermissionStatus().then((status) => {
        setNotifPermissionGranted(status === 'granted');
      });
    }, [])
  );

  async function handleEnableNotifications() {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted' && !current.canAskAgain) {
      ExpoLinking.openSettings();
      return;
    }
    const result = await requestAndRegisterPushToken();
    setNotifPermissionGranted(result.status === 'success');
    if (result.status === 'token_failed' || result.status === 'backend_failed') {
      // Permission is granted (the canAskAgain/Settings-redirect branch above
      // already handled the denied case) — the enable-notifications card
      // just stays visible for a retry, same as the permission-denied case,
      // but say why instead of leaving it unexplained.
      Alert.alert(
        t('booking:accountScreen.pushRegistrationFailedTitle'),
        t('booking:accountScreen.pushRegistrationFailedMessage')
      );
    }
  }

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

  // Scroll to and highlight the booking a notification tap was pointing at.
  useEffect(() => {
    if (!highlightBookingId || bookings.length === 0) return;
    const y = rowYPositions.current[highlightBookingId];
    if (y !== undefined) {
      requestAnimationFrame(() => {
        listRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
      });
    }
  }, [highlightBookingId, bookings]);

  // Arrived via the review-nudge push -- open that booking's rating panel
  // directly, same effect a manual "Rate"/"Edit review" tap would trigger.
  useEffect(() => {
    if (!openRatingBookingId || bookings.length === 0) return;
    if (openedRatingForDeepLink.current === openRatingBookingId) return;
    const item = bookings.find((b) => b.id === openRatingBookingId);
    if (item) {
      openedRatingForDeepLink.current = openRatingBookingId;
      handleOpenRating(item);
    }
  }, [openRatingBookingId, bookings]);

  // P6 — Wear OS customer glance. Fires whenever this screen's own bookings
  // list changes; no-op on iOS / when no watch is paired (see
  // modules/wear-bridge). Pushes role once per change too -- cheap, and
  // simpler than trying to fire it exactly once per session from here.
  useEffect(() => {
    if (bookings.length === 0 && loading) return;
    syncWearRole('customer');
    syncCustomerWearData(bookings);
  }, [bookings, loading]);

  async function fetchBookings() {
    try {
      setLoading(true);
      setLoadError(false);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE}/api/mobile/my-bookings`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (res.ok && json.data) setBookings(sortBookings(json.data));
      else setLoadError(true);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  }

  function handleReschedule(item: Booking) {
    router.push({
      pathname: '/booking/datetime',
      params: {
        salonId: item.client_id,
        salonName: item.agency_clients?.business_name ?? '',
        requireOnlinePayment: 'false',
        serviceIds: item.service_id ?? '',
        serviceNames: serviceDisplayName(item),
        totalCents: String(item.price_cents ?? 0),
        totalMins: String((item.services?.duration_minutes ?? 60) + (item.services?.buffer_minutes ?? 0)),
        staffId: item.staff_id ?? '',
        staffName: item.staff?.name ?? '',
        rescheduleBookingId: item.id,
      },
    });
  }

  function handlePayNow(item: Booking) {
    router.push({
      pathname: '/booking/pay-existing',
      params: {
        bookingId: item.id,
        priceCents: String(item.price_cents ?? 0),
        salonName: item.agency_clients?.business_name ?? '',
        serviceName: serviceDisplayName(item),
        startsAt: item.starts_at,
      },
    });
  }

  // Advisory only -- the server computes the authoritative outcome at
  // cancel time; this just tells the customer what to expect before they
  // confirm, using the same cutoff-hours math.
  function depositAdvisoryText(item: Booking): string | null {
    const depositCents = item.deposit_charged_cents ?? 0;
    if (depositCents <= 0) return null;
    const amount = formatCentsUSD(depositCents);
    if (!item.agency_clients?.deposit_refund_policy_enabled) {
      return t('booking:myBookingScreen.depositFlatNote', { amount });
    }
    const cutoffHours = item.agency_clients.deposit_refund_cutoff_hours ?? 24;
    const hoursUntilStart = (new Date(item.starts_at).getTime() - Date.now()) / 3_600_000;
    return hoursUntilStart >= cutoffHours
      ? t('booking:myBookingScreen.depositRefunded', { amount })
      : t('booking:myBookingScreen.depositNotRefunded', { amount, hours: cutoffHours });
  }

  function handleCancel(item: Booking) {
    const policy = item.agency_clients?.rescheduling_policy || item.agency_clients?.cancellation_policy;
    const depositNote = depositAdvisoryText(item);
    Alert.alert(
      t('booking:myBookingScreen.cancelAppointmentTitle'),
      (policy ? `${policy}\n\n` : '') +
        (depositNote ? `${depositNote}\n\n` : '') +
        t('booking:myBookingScreen.cancelCannotBeUndone'),
      [
        { text: t('booking:myBookingScreen.keepIt'), style: 'cancel' },
        {
          text: t('booking:myBookingScreen.yesCancel'),
          style: 'destructive',
          onPress: async () => {
            setActioningId(item.id);
            const result = await cancelBooking(item.id);
            setActioningId(null);
            if (!result.ok) {
              notificationError();
              Alert.alert(t('booking:myBookingScreen.couldNotCancelTitle'), result.error || t('errors:generic'));
              return;
            }
            notificationSuccess();
            if (result.deposit_refund_outcome === 'refunded') {
              Alert.alert(t('booking:myBookingScreen.cancelledTitle'), t('booking:myBookingScreen.depositRefundedMessage'));
            } else if (result.deposit_refund_outcome === 'forfeited') {
              Alert.alert(t('booking:myBookingScreen.cancelledTitle'), t('booking:myBookingScreen.depositForfeitedMessage'));
            }
            fetchBookings();
          },
        },
      ]
    );
  }

  function handleRebook(item: Booking) {
    router.push({
      pathname: '/booking/staff',
      params: {
        salonId: item.client_id,
        salonSlug: '',
        salonName: item.agency_clients?.business_name ?? '',
        requireOnlinePayment: 'true',
        serviceIds: item.service_id ?? '',
        serviceNames: serviceDisplayName(item),
        totalCents: String(item.price_cents ?? 0),
        totalMins: String((item.services?.duration_minutes ?? 60) + (item.services?.buffer_minutes ?? 0)),
      },
    });
  }

  function handleOpenRating(item: Booking) {
    setRatingId(item.id);
    // Editing an existing review pre-fills their actual rating; a new one
    // defaults to 5 stars so tapping Submit with no changes is a valid,
    // one-tap way to leave a review.
    setRatingStars(item.review?.stars ?? 5);
    setRatingText(item.review?.review_text ?? '');
  }

  async function handleSubmitRating() {
    if (!ratingId || ratingStars === 0) return;
    setSubmittingRating(true);
    const result = await submitBookingReview(ratingId, ratingStars, ratingText.trim() || undefined);
    setSubmittingRating(false);
    if (!result.ok) {
      notificationError();
      Alert.alert(t('booking:myBookingScreen.couldNotSubmitRatingTitle'), result.error || t('errors:tryAgain'));
      return;
    }
    notificationSuccess();
    const submittedStars = ratingStars;
    const submittedText = ratingText.trim() || null;
    const targetCustomerId = bookings.find((b) => b.id === ratingId)?.customer_id;
    setRatingId(null);
    // The review belongs to the customer (salon relationship), not just this
    // one booking -- every other booking at the same salon must show the
    // same updated review immediately, not just the one that was open.
    setBookings((prev) => prev.map((b) =>
      b.customer_id && b.customer_id === targetCustomerId
        ? { ...b, reviewed: true, review: { stars: submittedStars, review_text: submittedText } }
        : b
    ));
  }

  function handleViewReceipt(item: Booking) {
    router.push({
      pathname: '/booking/receipt',
      params: {
        salonName: item.agency_clients?.business_name ?? '',
        startsAt: item.starts_at,
        serviceName: serviceDisplayName(item),
        staffName: item.staff?.name ?? '',
        priceCents: String(item.price_cents ?? 0),
        taxCents: String(item.tax_cents ?? 0),
        tipCents: String(item.tip_cents ?? 0),
        totalCents: String(item.total_charged_cents ?? item.price_cents ?? 0),
      },
    });
  }

  function handleContactSalon(item: Booking) {
    const phone = item.agency_clients?.owner_phone;
    const salonName = item.agency_clients?.business_name ?? t('booking:myBookingScreen.salonFallbackLower');
    if (!phone) {
      Alert.alert(t('booking:myBookingScreen.contactInfoUnavailableTitle'), t('booking:myBookingScreen.reachOutDirectly', { salonName }));
      return;
    }
    Alert.alert(
      t('booking:myBookingScreen.contactSalonTitle', { salonName }),
      t('booking:myBookingScreen.tooCloseToReschedule'),
      [
        { text: t('booking:myBookingScreen.call'), onPress: () => Linking.openURL(`tel:${phone}`) },
        { text: t('booking:myBookingScreen.text'), onPress: () => Linking.openURL(`sms:${phone}`) },
        { text: t('booking:myBookingScreen.close'), style: 'cancel' },
      ]
    );
  }

  // Not signed in
  if (!authLoading && !user) {
    return (
      <View style={styles.screen}>
        <DualBreathingBackground />

          <SafeAreaView style={styles.container}>
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Canvas style={styles.emptyIconGlow} pointerEvents="none">
                  <Circle cx={54} cy={54} r={54}>
                    <RadialGradient
                      c={vec(54, 54)}
                      r={54}
                      colors={['rgba(212,175,55,0.28)', 'rgba(123,63,228,0.05)', 'transparent']}
                    />
                  </Circle>
                  <Circle
                    cx={54}
                    cy={54}
                    r={42}
                    style="stroke"
                    strokeWidth={2.5}
                    color="#F4D77A">
                    <BlurMask blur={8} style="solid" />
                  </Circle>
                </Canvas>
                <View style={styles.emptyIconRing}>
                  <Ionicons name="bookmark-outline" size={32} color="#F4D77A" />
                </View>
              </View>

              <Text style={styles.emptyTitle}>{t('booking:myBookingScreen.signedOutTitle')}</Text>
              <View style={styles.emptyDivider} />
              <Text style={styles.emptySubtitle}>
                {t('booking:myBookingScreen.signedOutSubtitle')}
              </Text>

              <RotatingGoldButton label={t('booking:myBookingScreen.signIn')} onPress={() => router.push('/auth')} />
            </View>
          </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('booking:myBookingScreen.title')}</Text>
          <View style={[styles.sparkle, { top: 2, left: 128, width: 3, height: 3 }]} />
          <View style={[styles.sparkle, { top: 18, left: 148, width: 2, height: 2 }]} />
          <View style={[styles.sparkle, { top: 30, left: 110, width: 2, height: 2 }]} />
          <View style={[styles.sparkle, { top: 8, left: 165, width: 2.5, height: 2.5 }]} />
        </View>

        {loading ? (
        <View style={styles.loadingContainer}>
          <BreathingHeart size={40} color="#F4D77A" />
        </View>
      ) : loadError && bookings.length === 0 ? (
        <ErrorState message={t('booking:myBookingScreen.loadErrorMessage')} onRetry={fetchBookings} />
      ) : bookings.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Canvas style={styles.emptyIconGlow} pointerEvents="none">
              <Circle cx={54} cy={54} r={54}>
                <RadialGradient
                  c={vec(54, 54)}
                  r={54}
                  colors={['rgba(212,175,55,0.28)', 'rgba(123,63,228,0.05)', 'transparent']}
                />
              </Circle>
              <Circle
                cx={54}
                cy={54}
                r={42}
                style="stroke"
                strokeWidth={2.5}
                color="#F4D77A">
                <BlurMask blur={8} style="solid" />
              </Circle>
            </Canvas>
            <View style={styles.emptyIconRing}>
              <Ionicons name="calendar-outline" size={32} color="#F4D77A" />
            </View>
          </View>

          <Text style={styles.emptyTitle}>{t('booking:myBookingScreen.emptyTitle')}</Text>
          <View style={styles.emptyDivider} />
          <Text style={styles.emptySubtitle}>{t('booking:myBookingScreen.emptySubtitle')}</Text>
          <RotatingGoldButton
            label={t('booking:myBookingScreen.bookFirstAppointment')}
            onPress={() => router.push('/(tabs)/book')}
            breathe={notifPermissionGranted}
          />

          {!notifPermissionGranted && (
            <Pressable
              style={({ pressed }) => [{ width: '100%' }, pressed && { opacity: 0.85 }]}
              onPress={handleEnableNotifications}>
              <Reanimated.View style={[{ width: '100%' }, cardBounceStyle]}>
                <BlurView intensity={90} tint="dark" style={styles.journeyCard}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                    style={StyleSheet.absoluteFill}
                  />

                  <View style={styles.journeyIconRing}>
                    <Ionicons name="notifications-outline" size={22} color="#F4D77A" />
                  </View>

                  <View style={styles.journeyTextWrap}>
                    <Text style={styles.journeyTitle}>{t('booking:myBookingScreen.enableRemindersTitle')}</Text>
                    <Text style={styles.journeyDescription}>
                      {t('booking:myBookingScreen.enableRemindersDesc')}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="rgba(212,175,55,0.5)" />
                </BlurView>
              </Reanimated.View>
            </Pressable>
          )}
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          ref={listRef}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F4D77A" colors={['#F4D77A']} />
          }>
          {bookings.map((item) => {
            const isUpcoming = item.status === 'confirmed' && minutesUntil(item.starts_at) > 0;
            const cutoffMinutes = item.agency_clients?.booking_cutoff_minutes ?? 1440;
            const withinCutoff = minutesUntil(item.starts_at) >= cutoffMinutes;
            const isActioning = actioningId === item.id;
            const isHighlighted = item.id === highlightBookingId;

            return (
              <View
                key={item.id}
                style={[styles.card, isHighlighted && styles.cardHighlighted]}
                onLayout={(e) => { rowYPositions.current[item.id] = e.nativeEvent.layout.y; }}>
                <CardOverlay />
                <View style={styles.cardTop}>
                  <Text style={styles.salonName}>
                    {item.agency_clients?.business_name ?? t('booking:myBookingScreen.salonFallback')}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                      {statusLabel(item.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardRow}>
                  <Ionicons name="calendar-outline" size={14} color="#F4D77A" />
                  <Text style={styles.cardDetail}>{formatDateTime(item.starts_at)}</Text>
                </View>

                {serviceDisplayName(item) !== '' && (
                  <View style={styles.cardRow}>
                    <Ionicons name="cut-outline" size={14} color="#F4D77A" />
                    <Text style={styles.cardDetail}>{serviceDisplayName(item)}</Text>
                  </View>
                )}

                {item.staff?.name && (
                  <View style={styles.cardRow}>
                    <Ionicons name="person-outline" size={14} color="#F4D77A" />
                    <Text style={styles.cardDetail}>{item.staff.name}</Text>
                  </View>
                )}

                {item.price_cents && item.price_cents > 0 && (
                  <Text style={styles.price}>
                    {formatCentsUSD(item.price_cents)}
                  </Text>
                )}

                {item.status === 'pending' && item.price_cents && item.price_cents > 0 && (
                  <>
                    <View style={styles.paymentDuePill}>
                      <Ionicons name="card-outline" size={12} color="#09000F" />
                      <Text style={styles.paymentDuePillText}>
                        {t('booking:myBookingScreen.paymentDue', { amount: formatCentsUSD(item.price_cents) })}
                      </Text>
                    </View>
                    <View style={styles.actionsRow}>
                      <Pressable style={styles.payNowBtn} onPress={() => handlePayNow(item)}>
                        <Ionicons name="card-outline" size={14} color="#09000F" />
                        <Text style={styles.payNowBtnText}>{t('booking:myBookingScreen.payNow')}</Text>
                      </Pressable>
                    </View>
                  </>
                )}

                {isUpcoming && (
                  <View style={styles.actionsRow}>
                    {isActioning ? (
                      <View style={{ paddingVertical: Spacing.sm }}><BreathingHeart size={18} color="#F4D77A" /></View>
                    ) : withinCutoff ? (
                      <>
                        <Pressable style={styles.actionBtn} onPress={() => handleReschedule(item)}>
                          <Ionicons name="calendar-outline" size={14} color="#F4D77A" />
                          <Text style={styles.actionBtnText}>{t('booking:myBookingScreen.reschedule')}</Text>
                        </Pressable>
                        <Pressable style={styles.actionBtnDanger} onPress={() => handleCancel(item)}>
                          <Ionicons name="close-circle-outline" size={14} color="#F09595" />
                          <Text style={styles.actionBtnDangerText}>{t('booking:myBookingScreen.cancel')}</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable style={styles.actionBtn} onPress={() => handleContactSalon(item)}>
                        <Ionicons name="call-outline" size={14} color="#F4D77A" />
                        <Text style={styles.actionBtnText}>{t('booking:myBookingScreen.contactSalon')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {!isUpcoming && item.status !== 'pending' && (
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.actionBtn} onPress={() => handleRebook(item)}>
                      <Ionicons name="repeat-outline" size={14} color="#F4D77A" />
                      <Text style={styles.actionBtnText}>{t('booking:myBookingScreen.rebook')}</Text>
                    </Pressable>
                    {item.status === 'completed' && (
                      <Pressable style={styles.actionBtn} onPress={() => handleOpenRating(item)}>
                        <Ionicons name={item.reviewed ? 'star' : 'star-outline'} size={14} color="#F4D77A" />
                        <Text style={styles.actionBtnText}>{item.reviewed ? t('booking:myBookingScreen.editReview') : t('booking:myBookingScreen.rate')}</Text>
                      </Pressable>
                    )}
                    {item.status === 'completed' && (
                      <Pressable style={styles.actionBtn} onPress={() => handleViewReceipt(item)}>
                        <Ionicons name="receipt-outline" size={14} color="#F4D77A" />
                        <Text style={styles.actionBtnText}>{t('booking:myBookingScreen.receipt')}</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {ratingId === item.id && (
                  <View style={styles.ratingPanel}>
                    <Text style={styles.ratingLabel}>{item.reviewed ? t('booking:myBookingScreen.editYourReview') : t('booking:myBookingScreen.howWasYourVisit')}</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable key={n} onPress={() => setRatingStars(n)} hitSlop={6}>
                          <Ionicons
                            name={n <= ratingStars ? 'star' : 'star-outline'}
                            size={28}
                            color="#F4D77A"
                          />
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      style={styles.ratingTextInput}
                      placeholder={t('booking:myBookingScreen.commentPlaceholder')}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      value={ratingText}
                      onChangeText={setRatingText}
                      multiline
                    />
                    <View style={styles.ratingActions}>
                      <Pressable onPress={() => { setRatingId(null); setRatingText(''); }}>
                        <Text style={styles.ratingCancelText}>{t('booking:myBookingScreen.cancel')}</Text>
                      </Pressable>
                      <Pressable
                        style={styles.ratingSubmitBtn}
                        onPress={handleSubmitRating}
                        disabled={ratingStars === 0 || submittingRating}>
                        {submittingRating ? (
                          <BreathingHeart size={16} color="#09000F" />
                        ) : (
                          <Text style={styles.ratingSubmitText}>{t('booking:myBookingScreen.submit')}</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },

  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: FontSize['2xl'] + 6,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  sparkle: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#F4D77A',
    shadowColor: '#F4D77A',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },

  emptyIconWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    marginTop: -96,
  },

  emptyIconGlow: { position: 'absolute', width: 108, height: 108 },

  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },

  emptyTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: FontSize.xl + 4,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },

  emptyDivider: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.4)',
  },

  emptySubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  signInBtnGlowWrap: {
    marginTop: Spacing.md,
    borderRadius: 30,
    shadowColor: '#D4AF37',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 72,
    borderRadius: 30,
    paddingHorizontal: Spacing.xl,
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    overflow: 'hidden',
  },
  signInBtnHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  signInBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },

  journeyCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: Spacing.lg,
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },

  journeyIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },

  journeyTextWrap: { flex: 1, gap: 2 },

  journeyTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  journeyDescription: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: FontSize.xs * 1.5,
  },

  list: { padding: Spacing.xl, gap: Spacing.md },

  card: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    overflow: 'hidden',
  },
  cardHighlighted: {
    borderColor: '#F4D77A',
    borderWidth: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salonName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    flex: 1,
  },
  statusBadge: {
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardDetail: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  price: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
    marginTop: Spacing.xs,
  },

  paymentDuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    marginTop: Spacing.xs,
  },
  paymentDuePillText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: '#09000F',
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
  },
  payNowBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: '#09000F',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.25)',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },
  actionBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: '#F4D77A',
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(226,74,74,0.1)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,74,74,0.4)',
  },
  actionBtnDangerText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: '#F09595',
  },

  ratingPanel: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.25)',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  ratingLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  starRow: { flexDirection: 'row', gap: Spacing.sm },
  ratingTextInput: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    minHeight: 44,
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    textAlignVertical: 'top',
  },
  ratingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  ratingCancelText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
  },
  ratingSubmitBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  ratingSubmitText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#09000F',
  },
});
