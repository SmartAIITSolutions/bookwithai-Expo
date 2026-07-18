// salon/[id].tsx — "id" here is the salon slug (e.g. "brows-by-tina")
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { fetchSalonBySlug, formatHours, type SalonInfo } from '@/lib/api/salon';
import { fetchCustomerSummary, type CustomerSummary } from '@/lib/api/customer';
import { useAuth } from '@/lib/auth/AuthContext';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';
import { ErrorState } from '@/components/ErrorState';

function formatCentsShort(cents: number) {
  return `$${(cents / 100).toFixed(0)}`;
}

function formatLastVisit(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function SalonScreen() {
  const { id: slug } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [salon, setSalon] = useState<SalonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);

  function load() {
    if (!slug) return;
    setLoading(true);
    setLoadError(false);
    setNotFound(false);
    fetchSalonBySlug(slug)
      .then((data) => {
        if (!data) setNotFound(true);
        else setSalon(data);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [slug]);

  useEffect(() => {
    if (!user || !salon) return;
    fetchCustomerSummary(salon.id).then(setSummary);
  }, [user, salon]);

  function handleCall() {
    if (salon?.phone) Linking.openURL(`tel:${salon.phone}`);
  }

  function handleDirections() {
    const addr = [salon?.address, salon?.city, salon?.state, salon?.zip]
      .filter(Boolean)
      .join(', ');
    const encoded = encodeURIComponent(addr);
    Linking.openURL(`https://maps.apple.com/?q=${encoded}`);
  }

  function handleBookNow() {
    router.push({
      pathname: '/booking/services',
      params: {
        salonId: salon?.id,
        salonSlug: slug,
        salonName: salon?.business_name,
        requireOnlinePayment: String(salon?.require_online_payment ?? true),
      },
    });
  }

  // ── Loading ─────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  // ── Load error ──────────────────────────────────────
  if (loadError) {
    return (
      <SafeAreaView style={styles.centered}>
        <ErrorState message="Unable to load this salon. Please check your connection and try again." onRetry={load} />
      </SafeAreaView>
    );
  }

  // ── Not found ───────────────────────────────────────
  if (notFound || !salon) {
    return (
      <SafeAreaView style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.notFoundTitle}>Salon not found</Text>
        <Text style={styles.notFoundSub}>
          This link may be invalid or the salon is no longer available.
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/book')}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const hours = formatHours(salon.business_hours);
  const fullAddress = [salon.address, salon.city, salon.state, salon.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          {salon.logo_url ? (
            <Image source={{ uri: salon.logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoInitial}>
                {salon.business_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.salonName}>{salon.business_name}</Text>
          <Text style={styles.poweredBy}>Powered by Book With AI</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {salon.phone && (
            <Pressable style={styles.actionBtn} onPress={handleCall}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Call</Text>
            </Pressable>
          )}
          {fullAddress && (
            <Pressable style={styles.actionBtn} onPress={handleDirections}>
              <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
              <Text style={styles.actionBtnText}>Directions</Text>
            </Pressable>
          )}
        </View>

        {/* Existing customer summary */}
        {summary && !summary.is_new_customer && (
          <View style={styles.card}>
            <View style={styles.summaryHeaderRow}>
              <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>Welcome back!</Text>
            </View>
            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{summary.total_bookings}</Text>
                <Text style={styles.summaryStatLabel}>Visits</Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryStatValue}>{formatCentsShort(summary.total_spent_cents)}</Text>
                <Text style={styles.summaryStatLabel}>Total Spent</Text>
              </View>
              {summary.last_visit && (
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryStatValue}>{formatLastVisit(summary.last_visit)}</Text>
                  <Text style={styles.summaryStatLabel}>Last Visit</Text>
                </View>
              )}
            </View>
            {summary.birthday_this_week && (
              <View style={styles.summaryBanner}>
                <Ionicons name="gift-outline" size={16} color={Colors.primary} />
                <Text style={styles.summaryBannerText}>Happy birthday week! Ask about a special treat.</Text>
              </View>
            )}
            {summary.available_rewards.length > 0 && (
              <View style={styles.summaryBanner}>
                <Ionicons name="pricetag-outline" size={16} color={Colors.primary} />
                <Text style={styles.summaryBannerText}>
                  {summary.available_rewards.length === 1
                    ? 'You have a reward available at checkout.'
                    : `You have ${summary.available_rewards.length} rewards available at checkout.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Address */}
        {fullAddress ? (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Ionicons name="location-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardText}>{fullAddress}</Text>
            </View>
          </View>
        ) : null}

        {/* Hours */}
        {hours.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hours</Text>
            {hours.map(({ day, label }) => (
              <View key={day} style={styles.hoursRow}>
                <Text style={styles.hoursDay}>{day}</Text>
                <Text
                  style={[
                    styles.hoursLabel,
                    label === 'Closed' && styles.hoursClosed,
                  ]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Policies */}
        {salon.cancellation_policy && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cancellation Policy</Text>
            <Text style={styles.policyText}>{salon.cancellation_policy}</Text>
          </View>
        )}
        {salon.rescheduling_policy && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rescheduling Policy</Text>
            <Text style={styles.policyText}>{salon.rescheduling_policy}</Text>
          </View>
        )}
        {salon.store_policy && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Store Policy</Text>
            <Text style={styles.policyText}>{salon.store_policy}</Text>
          </View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Book Now — sticky bottom */}
      <View style={styles.footer}>
        <Pressable style={styles.bookBtn} onPress={handleBookNow}>
          <Text style={styles.bookBtnText}>Book Now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  scroll: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: 120,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  logo: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.lg,
  },
  logoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundLavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 36,
    color: Colors.primary,
  },
  salonName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  poweredBy: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    letterSpacing: 0.4,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.white,
    ...Shadows.subtle,
  },
  actionBtnText: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.base,
    color: Colors.primary,
  },

  // Cards
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  cardTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  cardText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: FontSize.base * 1.5,
  },

  // Existing customer summary
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
  },
  summaryStatValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  summaryStatLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  summaryBannerText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
  },

  // Hours
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  hoursDay: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    width: 40,
  },
  hoursLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  hoursClosed: {
    color: Colors.textDisabled,
  },

  // Policies
  policyText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.7,
  },

  // Not found
  notFoundTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  notFoundSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  backBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },

  spacer: { height: Spacing.xl },

  // Footer
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
  bookBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    ...Shadows.button,
  },
  bookBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
