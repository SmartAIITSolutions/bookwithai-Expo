import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BreathingHeart } from '@/components/BreathingHeart';
import { InvisibleRefreshControl, RefreshHeartOverlay } from '@/components/PullToRefreshHeart';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { cancelBooking } from '@/lib/api/bookingActions';
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
  price_cents: number | null;
  tax_cents: number | null;
  tip_cents: number | null;
  total_charged_cents: number | null;
  notes: string | null;
  reviewed: boolean;
  agency_clients: {
    business_name: string;
    owner_phone: string | null;
    booking_cutoff_minutes: number | null;
    cancellation_policy: string | null;
    rescheduling_policy: string | null;
  } | null;
  staff: { id: string; name: string } | null;
  services: { id: string; name: string; duration_minutes: number; buffer_minutes: number | null } | null;
}

function formatDateTime(isoStr: string) {
  const d = new Date(isoStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()} · ${h}:${m} ${ampm}`;
}

function statusColor(status: string) {
  switch (status) {
    case 'confirmed': return Colors.success;
    case 'pending':   return Colors.warning;
    case 'cancelled': return Colors.error;
    default:          return 'rgba(255,255,255,0.6)';
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
  const { user, loading: authLoading } = useAuth();
  const { highlightBookingId } = useLocalSearchParams<{ highlightBookingId?: string }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [notifPermissionGranted, setNotifPermissionGranted] = useState(true);
  const listRef = useRef<FlatList<Booking>>(null);
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
    const granted = await requestAndRegisterPushToken();
    setNotifPermissionGranted(granted);
  }

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

  // Scroll to and highlight the booking a notification tap was pointing at.
  useEffect(() => {
    if (!highlightBookingId || bookings.length === 0) return;
    const index = bookings.findIndex((b) => b.id === highlightBookingId);
    if (index >= 0) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
      });
    }
  }, [highlightBookingId, bookings]);

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
        serviceNames: item.services?.name ?? '',
        totalCents: String(item.price_cents ?? 0),
        totalMins: String((item.services?.duration_minutes ?? 60) + (item.services?.buffer_minutes ?? 0)),
        staffId: item.staff_id ?? '',
        staffName: item.staff?.name ?? '',
        rescheduleBookingId: item.id,
      },
    });
  }

  function handleCancel(item: Booking) {
    const policy = item.agency_clients?.rescheduling_policy || item.agency_clients?.cancellation_policy;
    Alert.alert(
      'Cancel appointment?',
      (policy ? `${policy}\n\n` : '') +
        "This can't be undone. Any refund, if applicable, will be handled directly by the salon.",
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActioningId(item.id);
            const result = await cancelBooking(item.id);
            setActioningId(null);
            if (!result.ok) {
              notificationError();
              Alert.alert('Could not cancel', result.error || 'Something went wrong. Please try again.');
              return;
            }
            notificationSuccess();
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
        serviceNames: item.services?.name ?? '',
        totalCents: String(item.price_cents ?? 0),
        totalMins: String((item.services?.duration_minutes ?? 60) + (item.services?.buffer_minutes ?? 0)),
      },
    });
  }

  function handleOpenRating(item: Booking) {
    setRatingId(item.id);
    setRatingStars(0);
  }

  async function handleSubmitRating() {
    if (!ratingId || ratingStars === 0) return;
    setSubmittingRating(true);
    const result = await submitBookingReview(ratingId, ratingStars);
    setSubmittingRating(false);
    if (!result.ok) {
      notificationError();
      Alert.alert('Could not submit rating', result.error || 'Please try again.');
      return;
    }
    notificationSuccess();
    setRatingId(null);
    setBookings((prev) => prev.map((b) => (b.id === ratingId ? { ...b, reviewed: true } : b)));
  }

  function handleViewReceipt(item: Booking) {
    router.push({
      pathname: '/booking/receipt',
      params: {
        salonName: item.agency_clients?.business_name ?? '',
        startsAt: item.starts_at,
        serviceName: item.services?.name ?? '',
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
    const salonName = item.agency_clients?.business_name ?? 'the salon';
    if (!phone) {
      Alert.alert('Contact info unavailable', `Please reach out to ${salonName} directly.`);
      return;
    }
    Alert.alert(
      `Contact ${salonName}`,
      "This appointment is too close to reschedule or cancel online — please contact the salon directly.",
      [
        { text: 'Call', onPress: () => Linking.openURL(`tel:${phone}`) },
        { text: 'Text', onPress: () => Linking.openURL(`sms:${phone}`) },
        { text: 'Close', style: 'cancel' },
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

              <Text style={styles.emptyTitle}>Your bookings live here</Text>
              <View style={styles.emptyDivider} />
              <Text style={styles.emptySubtitle}>
                Sign in to see your upcoming and past appointments.
              </Text>

              <RotatingGoldButton label="Sign In" onPress={() => router.push('/auth')} />
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
          <Text style={styles.title}>My Bookings</Text>
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
        <ErrorState message="Unable to load your bookings. Please check your connection and try again." onRetry={fetchBookings} />
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

          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <View style={styles.emptyDivider} />
          <Text style={styles.emptySubtitle}>Book your first appointment to get started.</Text>
          <RotatingGoldButton
            label="Book Your First Appointment"
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
                    <Text style={styles.journeyTitle}>Turn on reminders & updates</Text>
                    <Text style={styles.journeyDescription}>
                      Tap to get notified about your upcoming appointments.
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={18} color="rgba(212,175,55,0.5)" />
                </BlurView>
              </Reanimated.View>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={{ flex: 1 }}>
        <RefreshHeartOverlay refreshing={refreshing} />
        <FlatList
          style={{ flex: 1 }}
          ref={listRef}
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<InvisibleRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item }) => {
            const isUpcoming = item.status === 'confirmed' && minutesUntil(item.starts_at) > 0;
            const cutoffMinutes = item.agency_clients?.booking_cutoff_minutes ?? 1440;
            const withinCutoff = minutesUntil(item.starts_at) >= cutoffMinutes;
            const isActioning = actioningId === item.id;
            const isHighlighted = item.id === highlightBookingId;

            return (
              <View style={[styles.card, isHighlighted && styles.cardHighlighted]}>
                <CardOverlay />
                <View style={styles.cardTop}>
                  <Text style={styles.salonName}>
                    {item.agency_clients?.business_name ?? 'Salon'}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardRow}>
                  <Ionicons name="calendar-outline" size={14} color="#F4D77A" />
                  <Text style={styles.cardDetail}>{formatDateTime(item.starts_at)}</Text>
                </View>

                {item.services?.name && (
                  <View style={styles.cardRow}>
                    <Ionicons name="cut-outline" size={14} color="#F4D77A" />
                    <Text style={styles.cardDetail}>{item.services.name}</Text>
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
                    ${(item.price_cents / 100).toFixed(2)}
                  </Text>
                )}

                {isUpcoming && (
                  <View style={styles.actionsRow}>
                    {isActioning ? (
                      <View style={{ paddingVertical: Spacing.sm }}><BreathingHeart size={18} color="#F4D77A" /></View>
                    ) : withinCutoff ? (
                      <>
                        <Pressable style={styles.actionBtn} onPress={() => handleReschedule(item)}>
                          <Ionicons name="calendar-outline" size={14} color="#F4D77A" />
                          <Text style={styles.actionBtnText}>Reschedule</Text>
                        </Pressable>
                        <Pressable style={styles.actionBtnDanger} onPress={() => handleCancel(item)}>
                          <Ionicons name="close-circle-outline" size={14} color="#F09595" />
                          <Text style={styles.actionBtnDangerText}>Cancel</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable style={styles.actionBtn} onPress={() => handleContactSalon(item)}>
                        <Ionicons name="call-outline" size={14} color="#F4D77A" />
                        <Text style={styles.actionBtnText}>Contact Salon</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {!isUpcoming && (
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.actionBtn} onPress={() => handleRebook(item)}>
                      <Ionicons name="repeat-outline" size={14} color="#F4D77A" />
                      <Text style={styles.actionBtnText}>Rebook</Text>
                    </Pressable>
                    {item.status === 'completed' && !item.reviewed && (
                      <Pressable style={styles.actionBtn} onPress={() => handleOpenRating(item)}>
                        <Ionicons name="star-outline" size={14} color="#F4D77A" />
                        <Text style={styles.actionBtnText}>Rate</Text>
                      </Pressable>
                    )}
                    {item.status === 'completed' && (
                      <Pressable style={styles.actionBtn} onPress={() => handleViewReceipt(item)}>
                        <Ionicons name="receipt-outline" size={14} color="#F4D77A" />
                        <Text style={styles.actionBtnText}>Receipt</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {ratingId === item.id && (
                  <View style={styles.ratingPanel}>
                    <Text style={styles.ratingLabel}>How was your visit?</Text>
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
                    <View style={styles.ratingActions}>
                      <Pressable onPress={() => setRatingId(null)}>
                        <Text style={styles.ratingCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={styles.ratingSubmitBtn}
                        onPress={handleSubmitRating}
                        disabled={ratingStars === 0 || submittingRating}>
                        {submittingRating ? (
                          <BreathingHeart size={16} color="#09000F" />
                        ) : (
                          <Text style={styles.ratingSubmitText}>Submit</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            );
          }}
        />
        </View>
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
