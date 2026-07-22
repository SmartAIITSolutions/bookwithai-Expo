// salon/[id].tsx — "id" here is the salon slug (e.g. "brows-by-tina")
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import Reanimated, {
  Easing,
  SharedValue,
  SlideInLeft,
  SlideInRight,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { fetchSalonBySlug, formatHours, type SalonInfo } from '@/lib/api/salon';
import { fetchCustomerSummary, type CustomerSummary } from '@/lib/api/customer';
import { useFavorites } from '@/lib/favorites/FavoritesContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { ErrorState } from '@/components/ErrorState';

const POLICY_COUNT = 3;
const POLICY_CYCLE_DURATION = 3600;

function usePolicyBreatheStyle(cycle: SharedValue<number>, index: number) {
  return useAnimatedStyle(() => {
    const raw = Math.abs(cycle.value - index);
    const d = Math.min(raw, POLICY_COUNT - raw);
    const intensity = Math.max(0, 1 - d);
    return { transform: [{ scale: 1 + intensity * 0.03 }] };
  });
}

const AnimatedLinearGradient = Reanimated.createAnimatedComponent(LinearGradient);

function BookNowButton({ onPress }: { onPress: () => void }) {
  const angle = useSharedValue(0);
  const breatheVal = useSharedValue(0);
  const textSpin = useSharedValue(0);

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: 2600, easing: Easing.linear }),
      -1,
      false
    );
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
  }, [angle, breatheVal, textSpin]);

  const animatedProps = useAnimatedProps(() => {
    const rad = (angle.value * Math.PI) / 180;
    return {
      start: { x: 0.5 + 0.5 * Math.cos(rad + Math.PI), y: 0.5 + 0.5 * Math.sin(rad + Math.PI) },
      end: { x: 0.5 + 0.5 * Math.cos(rad), y: 0.5 + 0.5 * Math.sin(rad) },
    };
  });

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breatheVal.value * 0.03 }],
  }));

  const textSpinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${textSpin.value}deg` }],
  }));

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Reanimated.View style={[breatheStyle, pressed && { opacity: 0.85 }]}>
          <AnimatedLinearGradient
            colors={['#F4D77A', '#D4AF37', '#F4D77A']}
            animatedProps={animatedProps}
            style={styles.bookBtn}>
            <Reanimated.Text style={[styles.bookBtnText, textSpinStyle]}>Book Now</Reanimated.Text>
          </AnimatedLinearGradient>
        </Reanimated.View>
      )}
    </Pressable>
  );
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

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
  const { width, height } = useWindowDimensions();
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [salon, setSalon] = useState<SalonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const { salons: favoriteSalons, addFavorite, removeFavorite } = useFavorites();
  const isFavorite = !!salon && favoriteSalons.some((s) => s.id === salon.id);

  const policyCycle = useSharedValue(0);
  useEffect(() => {
    policyCycle.value = withRepeat(
      withTiming(POLICY_COUNT, { duration: POLICY_CYCLE_DURATION, easing: Easing.linear }),
      -1,
      false
    );
  }, [policyCycle]);
  const cancellationBreathe = usePolicyBreatheStyle(policyCycle, 0);
  const reschedulingBreathe = usePolicyBreatheStyle(policyCycle, 1);
  const storeBreathe = usePolicyBreatheStyle(policyCycle, 2);

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

  async function handleToggleFavorite() {
    if (!salon) return;
    if (!user) {
      router.push('/auth');
      return;
    }
    setFavoriteBusy(true);
    try {
      if (isFavorite) {
        await removeFavorite(salon.id);
      } else {
        await addFavorite(salon.id);
      }
    } catch {
      Alert.alert('Could not update', 'Please try again.');
    } finally {
      setFavoriteBusy(false);
    }
  }

  function handleCall() {
    if (salon?.owner_phone) Linking.openURL(`tel:${salon.owner_phone}`);
  }

  function handleDirections() {
    const addr = [salon?.address_line1, salon?.address_line2, salon?.city, salon?.state, salon?.postal_code]
      .filter(Boolean)
      .join(', ');
    if (!addr) {
      Alert.alert('Address not available', 'Please check with the salon directly for their location.');
      return;
    }
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
      <View style={styles.screen}>
        <DualBreathingBackground />
        <SafeAreaView style={styles.centered}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#F4D77A" />
          </Pressable>
          <BreathingHeart size={40} color="#F4D77A" />
        </SafeAreaView>
      </View>
    );
  }

  // ── Load error ──────────────────────────────────────
  if (loadError) {
    return (
      <View style={styles.screen}>
        <DualBreathingBackground />
        <SafeAreaView style={styles.centered}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.7 }]}
            hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color="#F4D77A" />
          </Pressable>
          <ErrorState message="Unable to load this salon. Please check your connection and try again." onRetry={load} />
        </SafeAreaView>
      </View>
    );
  }

  // ── Not found ───────────────────────────────────────
  if (notFound || !salon) {
    return (
      <View style={styles.screen}>
        <DualBreathingBackground />
        <SafeAreaView style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.5)" />
          <Text style={styles.notFoundTitle}>Salon not found</Text>
          <Text style={styles.notFoundSub}>
            This link may be invalid or the salon is no longer available.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.replace('/book')}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  const hours = formatHours(salon.business_hours);

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add this salon to favorites'}
            onPress={handleToggleFavorite}
            disabled={favoriteBusy}
            style={({ pressed }) => [styles.favoriteBtn, isFavorite && styles.favoriteBtnActive, pressed && { opacity: 0.85 }]}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? '#09000F' : '#F4D77A'}
            />
            <Text style={[styles.favoriteBtnText, isFavorite && styles.favoriteBtnTextActive]}>
              {isFavorite ? 'Saved to Favorites' : 'Add this salon to favorites'}
            </Text>
          </Pressable>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {salon.owner_phone && (
            <Pressable style={styles.actionBtn} onPress={handleCall}>
              <Ionicons name="call-outline" size={20} color="#F4D77A" />
              <Text style={styles.actionBtnText}>Call</Text>
            </Pressable>
          )}
          <Pressable style={styles.actionBtn} onPress={handleDirections}>
            <Ionicons name="navigate-outline" size={20} color="#F4D77A" />
            <Text style={styles.actionBtnText}>Directions</Text>
          </Pressable>
        </View>

        {/* Existing customer summary */}
        {summary && !summary.is_new_customer && (
          <View style={styles.card}>
            <CardOverlay />
            <View style={styles.summaryHeaderRow}>
              <Ionicons name="sparkles-outline" size={18} color="#F4D77A" />
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
                <Ionicons name="gift-outline" size={16} color="#F4D77A" />
                <Text style={styles.summaryBannerText}>Happy birthday week! Ask about a special treat.</Text>
              </View>
            )}
            {summary.available_rewards.length > 0 && (
              <View style={styles.summaryBanner}>
                <Ionicons name="pricetag-outline" size={16} color="#F4D77A" />
                <Text style={styles.summaryBannerText}>
                  {summary.available_rewards.length === 1
                    ? 'You have a reward available at checkout.'
                    : `You have ${summary.available_rewards.length} rewards available at checkout.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Hours */}
        {hours.length > 0 && (
          <View style={[styles.card, styles.hoursCard]}>
            <CardOverlay />
            <Pressable
              style={styles.hoursHeaderRow}
              onPress={() => setHoursExpanded((v) => !v)}>
              <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Store Hours</Text>
              <Ionicons
                name={hoursExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#F4D77A"
              />
            </Pressable>
            {hoursExpanded && (
              <View style={styles.hoursRowsWrap}>
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
          </View>
        )}

        {/* Policies */}
        {salon.cancellation_policy && (
          <Reanimated.View entering={SlideInRight.duration(1000).delay(0)}>
            <Reanimated.View style={[styles.card, cancellationBreathe]}>
              <CardOverlay />
              <Text style={styles.cardTitle}>Cancellation Policy</Text>
              <Text style={styles.policyText}>{salon.cancellation_policy}</Text>
            </Reanimated.View>
          </Reanimated.View>
        )}
        {salon.rescheduling_policy && (
          <Reanimated.View entering={SlideInLeft.duration(1000).delay(400)}>
            <Reanimated.View style={[styles.card, reschedulingBreathe]}>
              <CardOverlay />
              <Text style={styles.cardTitle}>Rescheduling Policy</Text>
              <Text style={styles.policyText}>{salon.rescheduling_policy}</Text>
            </Reanimated.View>
          </Reanimated.View>
        )}
        {salon.store_policy && (
          <Reanimated.View entering={SlideInRight.duration(1000).delay(800)}>
            <Reanimated.View style={[styles.card, storeBreathe]}>
              <CardOverlay />
              <Text style={styles.cardTitle}>Store Policy</Text>
              <Text style={styles.policyText}>{salon.store_policy}</Text>
            </Reanimated.View>
          </Reanimated.View>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      {/* Book Now — sticky bottom */}
      <View style={styles.footer}>
        <BookNowButton onPress={handleBookNow} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backIconBtn, pressed && { opacity: 0.7 }]}
        hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color="#F4D77A" />
      </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    backgroundColor: 'transparent',
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
  favoriteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.6)',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  favoriteBtnActive: {
    backgroundColor: '#F4D77A',
    borderColor: '#F4D77A',
  },
  favoriteBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#F4D77A',
  },
  favoriteBtnTextActive: {
    color: '#09000F',
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
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitial: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 36,
    color: '#F4D77A',
  },
  salonName: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['2xl'] + 2,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  poweredBy: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.4,
    marginTop: -16,
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    marginTop: -8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  actionBtnText: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },

  // Cards
  card: {
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
    marginBottom: Spacing.md,
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
    color: '#FFFFFF',
  },
  summaryStatLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(212,175,55,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
  },
  summaryBannerText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    flex: 1,
  },

  // Hours
  hoursCard: { marginTop: -16 },
  hoursHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hoursRowsWrap: { marginTop: Spacing.sm },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  hoursDay: {
    fontFamily: FontFamily.soraMedium,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    width: 40,
  },
  hoursLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  hoursClosed: {
    color: 'rgba(255,255,255,0.4)',
  },

  // Policies
  policyText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    lineHeight: FontSize.sm * 1.7,
  },

  // Not found
  notFoundTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  notFoundSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: '#F4D77A',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  backIconBtn: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  backBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },

  spacer: { height: Spacing.xl },

  // Footer
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
  bookBtn: {
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  bookBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#09000F',
  },
});
