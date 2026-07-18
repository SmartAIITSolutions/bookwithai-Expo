import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  Pressable, ActivityIndicator, Alert, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { cancelBooking } from '@/lib/api/bookingActions';
import { submitBookingReview } from '@/lib/api/customer';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { API_BASE } from '@/lib/config';
import { ErrorState } from '@/components/ErrorState';

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
    default:          return Colors.textSecondary;
  }
}

// Minutes between now and the appointment's start — negative once it's passed.
function minutesUntil(startsAt: string): number {
  return (new Date(startsAt).getTime() - Date.now()) / 60000;
}

export default function MyBookingScreen() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [ratingId, setRatingId] = useState<string | null>(null);
  const [ratingStars, setRatingStars] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);

  useEffect(() => {
    if (user) fetchBookings();
  }, [user]);

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
      if (res.ok && json.data) setBookings(json.data);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={48} color={Colors.textDisabled} />
          <Text style={styles.emptyTitle}>Your bookings live here</Text>
          <Text style={styles.emptySubtitle}>
            Sign in to see your upcoming and past appointments.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/auth')}>
            <Text style={styles.signInBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : loadError && bookings.length === 0 ? (
        <ErrorState message="Unable to load your bookings. Please check your connection and try again." onRetry={fetchBookings} />
      ) : bookings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textDisabled} />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>Book your first appointment to get started.</Text>
          <Pressable
            style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/(tabs)/book')}>
            <Text style={styles.signInBtnText}>Book Now</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => {
            const isUpcoming = item.status === 'confirmed' && minutesUntil(item.starts_at) > 0;
            const cutoffMinutes = item.agency_clients?.booking_cutoff_minutes ?? 1440;
            const withinCutoff = minutesUntil(item.starts_at) >= cutoffMinutes;
            const isActioning = actioningId === item.id;

            return (
              <View style={styles.card}>
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
                  <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                  <Text style={styles.cardDetail}>{formatDateTime(item.starts_at)}</Text>
                </View>

                {item.services?.name && (
                  <View style={styles.cardRow}>
                    <Ionicons name="cut-outline" size={14} color={Colors.primary} />
                    <Text style={styles.cardDetail}>{item.services.name}</Text>
                  </View>
                )}

                {item.staff?.name && (
                  <View style={styles.cardRow}>
                    <Ionicons name="person-outline" size={14} color={Colors.primary} />
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
                      <ActivityIndicator color={Colors.primary} style={{ paddingVertical: Spacing.sm }} />
                    ) : withinCutoff ? (
                      <>
                        <Pressable style={styles.actionBtn} onPress={() => handleReschedule(item)}>
                          <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                          <Text style={styles.actionBtnText}>Reschedule</Text>
                        </Pressable>
                        <Pressable style={styles.actionBtnDanger} onPress={() => handleCancel(item)}>
                          <Ionicons name="close-circle-outline" size={14} color={Colors.error} />
                          <Text style={styles.actionBtnDangerText}>Cancel</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable style={styles.actionBtn} onPress={() => handleContactSalon(item)}>
                        <Ionicons name="call-outline" size={14} color={Colors.primary} />
                        <Text style={styles.actionBtnText}>Contact Salon</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {!isUpcoming && (
                  <View style={styles.actionsRow}>
                    <Pressable style={styles.actionBtn} onPress={() => handleRebook(item)}>
                      <Ionicons name="repeat-outline" size={14} color={Colors.primary} />
                      <Text style={styles.actionBtnText}>Rebook</Text>
                    </Pressable>
                    {item.status === 'completed' && !item.reviewed && (
                      <Pressable style={styles.actionBtn} onPress={() => handleOpenRating(item)}>
                        <Ionicons name="star-outline" size={14} color={Colors.primary} />
                        <Text style={styles.actionBtnText}>Rate</Text>
                      </Pressable>
                    )}
                    {item.status === 'completed' && (
                      <Pressable style={styles.actionBtn} onPress={() => handleViewReceipt(item)}>
                        <Ionicons name="receipt-outline" size={14} color={Colors.primary} />
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
                            color={Colors.primary}
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
                          <ActivityIndicator color={Colors.white} size="small" />
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
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },
  signInBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  signInBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  list: { padding: Spacing.xl, gap: Spacing.md },

  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salonName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
  },
  price: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },

  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  actionBtnDangerText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: Colors.error,
  },

  ratingPanel: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  ratingLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
  },
  ratingSubmitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  ratingSubmitText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
});
