import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Image, ImageBackground, Animated, Easing, useWindowDimensions, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { supabase } from '@/lib/supabase';
import { API_BASE } from '@/lib/config';
import { STORE_URL, STORE_URL_FALLBACK } from '@/components/UpdateNagModal';
import {
  fetchNotifications, markNotificationRead,
  type NotificationItem,
} from '@/lib/notifications/api';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Only the "new booking created" balance_due push
// (owner/bookings/route.ts) embeds a date/time in its body, formatted as
// "Weekday, Mon D at H:MM AM/PM" -- the 48h-reminder and owner-triggered
// pushes don't. Extract it when present so the hero card can show it as
// its own highlighted line; fall back to the raw body when it's not.
function extractApptDateTime(body: string): string | null {
  const m = body.match(/[A-Z][a-z]+day, [A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2}\s?[AP]M/);
  return m ? m[0] : null;
}

// Some pushes (e.g. the 2h reminder -- "starts in 2 hours. See you at
// 9:30 AM.") only carry a bare time, no weekday/date. Fall back to just the
// time so those can still get a highlighted row instead of one flat line.
function extractApptTimeOnly(body: string): string | null {
  const m = body.match(/\d{1,2}:\d{2}\s?[AP]M/);
  return m ? m[0] : null;
}

// Rescheduled bodies embed two date/times ("...on {old} has been
// rescheduled to {new}...") -- grab both so the card can show the old one
// inline and highlight the new one.
function extractAllApptDateTimes(body: string): string[] {
  const m = body.match(/[A-Z][a-z]+day, [A-Z][a-z]{2} \d{1,2} at \d{1,2}:\d{2}\s?[AP]M/g);
  return m ?? [];
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// One visual category per notification type -- each carries its own
// gradient, icon badge tint, and accent color, matching the reference
// design. Multiple types share a category where the tone matches (e.g.
// every "you need to act on this" notification reads as pink/Action
// Required, not just balance_due).
type Category = 'confirmation' | 'payment' | 'action' | 'updates' | 'reminder' | 'rewards';

const CATEGORY_STYLES: Record<Category, {
  gradient: [string, string];
  iconBg: string;
  iconColor: string;
  accent: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = {
  confirmation: {
    gradient: ['#4B2E9E', '#211045'],
    iconBg: 'rgba(255,255,255,0.18)',
    iconColor: '#E4DBFF',
    accent: '#C9B8FF',
    icon: 'checkmark-done-circle-outline',
  },
  payment: {
    gradient: ['#1E7A56', '#0B2F22'],
    iconBg: 'rgba(255,255,255,0.16)',
    iconColor: '#C9F5DE',
    accent: '#7FE8B8',
    icon: 'card-outline',
  },
  action: {
    gradient: ['#83235A', '#390F26'],
    iconBg: 'rgba(255,255,255,0.16)',
    iconColor: '#FFD6E7',
    accent: '#FF8FC0',
    icon: 'heart-outline',
  },
  updates: {
    gradient: ['#25409E', '#0F1A42'],
    iconBg: 'rgba(255,255,255,0.16)',
    iconColor: '#D6E4FF',
    accent: '#93C5FD',
    icon: 'sync-outline',
  },
  reminder: {
    gradient: ['#8A5A12', '#3A2406'],
    iconBg: 'rgba(255,255,255,0.16)',
    iconColor: '#FFE6BF',
    accent: '#FBBF6C',
    icon: 'time-outline',
  },
  rewards: {
    gradient: ['#6B2E99', '#2A1049'],
    iconBg: 'rgba(255,255,255,0.16)',
    iconColor: '#EBD6FF',
    accent: '#D8B4FE',
    icon: 'gift-outline',
  },
};

const TYPE_CATEGORY: Record<string, Category> = {
  booking_confirmed: 'confirmation',
  receipt:            'payment',
  balance_due:         'action',
  cancelled:            'action',
  rebook_nudge:         'action',
  rescheduled:          'updates',
  app_update:            'updates',
  reminder_24h:          'reminder',
  reminder_2h:           'reminder',
  checkin_ready:         'reminder',
  review_nudge:          'rewards',
};

// Per-type icon override -- falls back to the category default above when
// a type doesn't need its own glyph.
const TYPE_ICON: Partial<Record<string, keyof typeof Ionicons.glyphMap>> = {
  booking_confirmed: 'calendar-outline',
  receipt:            'checkmark-circle-outline',
  balance_due:         'card-outline',
  cancelled:            'close-circle-outline',
  rebook_nudge:         'heart-outline',
  rescheduled:          'sync-outline',
  app_update:            'sparkles-outline',
  reminder_24h:          'time-outline',
  reminder_2h:           'alarm-outline',
  checkin_ready:         'location-outline',
  review_nudge:          'star-outline',
};

// Hero-card treatment (glowing panel background, stylized title, chevron)
// for every other notification type -- only balance_due and cancelled get
// their own dedicated render function (embedded button / date-row layout).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HERO_CARD_CONFIG: Partial<Record<string, {
  title: string;
  bg: any;
  accent: string;
  iconImage?: any;
  subtitle?: string;
  buttonLabel?: string;
  buttonIcon?: keyof typeof Ionicons.glyphMap;
}>> = {
  booking_confirmed: {
    title: 'You’re Booked! 🎉',
    bg: require('../../assets/images/notifications/pay-now-card-bg.png'),
    accent: '#C9B8FF',
    subtitle: 'You’re all set! Your appointment is confirmed for',
    iconImage: require('../../assets/images/notifications/booking-confirmed-icon.png'),
  },
  rescheduled: {
    title: 'Plans Updated ✨',
    bg: require('../../assets/images/notifications/rescheduled-card-bg.png'),
    accent: '#22D3EE',
    iconImage: require('../../assets/images/notifications/rescheduled-icon.png'),
    subtitle: 'Your appointment has been rescheduled to',
  },
  reminder_2h: {
    title: 'Your Appointment Is Coming Up ✨',
    bg: require('../../assets/images/notifications/reminder-card-bg.png'),
    accent: '#FBBF6C',
    iconImage: require('../../assets/images/notifications/reminder-2h-icon.png'),
  },
  reminder_24h: {
    title: 'See You Tomorrow 💜',
    bg: require('../../assets/images/notifications/pay-now-card-bg.png'),
    accent: '#D8B4FE',
    iconImage: require('../../assets/images/notifications/reminder-24h-icon.png'),
  },
  receipt: {
    title: 'Payment Complete ✅',
    bg: require('../../assets/images/notifications/receipt-card-bg.png'),
    accent: '#7FE8B8',
  },
  rebook_nudge: {
    title: 'Time to Rebook? 💕',
    bg: require('../../assets/images/notifications/rebook-card-bg.png'),
    accent: '#FF8FC0',
    buttonLabel: 'Rebook',
    buttonIcon: 'refresh',
  },
  app_update: {
    title: 'Update Available ✨',
    bg: require('../../assets/images/notifications/rescheduled-card-bg.png'),
    accent: '#7EB6FF',
    buttonLabel: 'Update Now',
    buttonIcon: 'arrow-up-circle',
  },
  checkin_ready: {
    title: 'Are You Here? 📍',
    bg: require('../../assets/images/notifications/reminder-card-bg.png'),
    accent: '#FBBF6C',
  },
  review_nudge: {
    title: 'How Was Your Visit? ⭐',
    bg: require('../../assets/images/notifications/pay-now-card-bg.png'),
    accent: '#D8B4FE',
  },
};

// Shared date/time row -- breathes (gentle scale pulse) and vibrates
// (small side-to-side wiggle) on a loop so the highlighted appointment
// time reads as more noticeable/alive, used identically across Pay Now,
// Cancelled, and every generic hero card's date row.
function AnimatedDateRow({ dateTime, color, rowStyle, textStyle }: {
  dateTime: string;
  color: string;
  rowStyle: object;
  textStyle: object;
}) {
  const breath = useRef(new Animated.Value(0)).current;
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const wiggleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 90, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(1400),
      ])
    );
    breathLoop.start();
    wiggleLoop.start();
    return () => {
      breathLoop.stop();
      wiggleLoop.stop();
    };
  }, [breath, wiggle]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const translateX = wiggle.interpolate({ inputRange: [-1, 1], outputRange: [-2.5, 2.5] });

  return (
    <Animated.View style={[rowStyle, { transform: [{ scale }, { translateX }] }]}>
      <Ionicons name="calendar-outline" size={15} color={color} />
      <Text style={[textStyle, { color }]}>{dateTime}.</Text>
    </Animated.View>
  );
}

function categoryFor(type: string): Category {
  return TYPE_CATEGORY[type] ?? 'updates';
}

// Gentle looping scale pulse -- shared by the calendar icon and the
// credit-card decoration so both feel alive without being distracting.
function BreathingImage({ source, style, rotateDeg }: { source: number; style: object; rotateDeg?: string }) {
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const transform = rotateDeg ? [{ rotate: rotateDeg }, { scale }] : [{ scale }];

  return <Animated.Image source={source} style={[style, { transform }]} />;
}

// Gold pill with a bright shine band that sweeps left-to-right on a loop,
// on top of a static gold gradient base -- the classic "cinematic" button
// shimmer, clipped to the button's rounded shape.
function HeroGoldButton({
  onPress,
  label,
  iconName,
}: {
  onPress: () => void;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
}) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const translateX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-140, 340] });

  const wiggle = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [wiggle]);
  const wiggleX = wiggle.interpolate({ inputRange: [-1, 1], outputRange: [-3, 3] });

  return (
    <Pressable onPress={onPress} style={styles.heroPayBtnWrap}>
      <View style={styles.heroPayBtnClip}>
        <LinearGradient
          colors={['#FDE8A8', '#F4D77A', '#D9A93B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View style={[styles.heroPayBtnShine, { transform: [{ translateX }, { rotate: '20deg' }] }]}>
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View style={[styles.heroPayBtn, { transform: [{ translateX: wiggleX }] }]}>
          <Ionicons name={iconName} size={16} color="#09000F" />
          <Text style={styles.heroPayBtnText}>{label}</Text>
          <Ionicons name="chevron-forward" size={16} color="#09000F" />
        </Animated.View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Explicit computed height (not aspectRatio -- that fights the row's
  // flex:1 text child in Yoga and ends up narrower than the sibling cards)
  // so the cancelled card matches the Pay Now hero card's proportions.
  const { width: windowWidth } = useWindowDimensions();
  const cancelledCardHeight = (windowWidth - Spacing.md * 2) / 2.6;
  // Per-notification "which check-in option did they just tap" feedback --
  // shows a brief confirmation in place of the 4 buttons instead of a toast.
  const [checkinSentFor, setCheckinSentFor] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const data = await fetchNotifications();
    setItems(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  function toLocalDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Lands straight on the Review Booking screen with the same stylist, a
  // slot 2 weeks after the last visit, and the same service/price already
  // filled in -- the customer can back out to staff/datetime to change
  // anything, but the default path is a single tap to confirm. Landing on
  // review.tsx skips the real availability check staff->datetime normally
  // does, so that exact 2-weeks-later slot is checked here first; if it's
  // no longer open, this falls back to the staff-picker instead of
  // silently building a booking for a slot that's actually taken.
  async function handleRebookPress(item: NotificationItem) {
    if (!item.booking_id) {
      router.push({ pathname: '/(tabs)/my-booking' });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE}/api/mobile/my-bookings`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      const booking = res.ok ? (json.data ?? []).find((b: { id: string }) => b.id === item.booking_id) : null;
      if (!booking) {
        router.push({ pathname: '/(tabs)/my-booking' });
        return;
      }
      const serviceNames = booking.service_names && booking.service_names.length > 0
        ? booking.service_names.join(' + ')
        : booking.services?.name ?? '';
      const totalMins = (booking.services?.duration_minutes ?? 60) + (booking.services?.buffer_minutes ?? 0);
      const staffName = booking.staff?.name ?? 'Any Available';
      const baseParams = {
        salonId: booking.client_id,
        salonSlug: '',
        salonName: booking.agency_clients?.business_name ?? '',
        requireOnlinePayment: 'true',
        serviceIds: booking.service_id ?? '',
        serviceNames,
        totalCents: String(booking.price_cents ?? 0),
        totalMins: String(totalMins),
      };
      const suggested = new Date(new Date(booking.starts_at).getTime() + 14 * 24 * 60 * 60 * 1000);

      // Check whether that exact slot is actually still open.
      const availUrl = new URL('https://bookwithai.app/api/availability');
      availUrl.searchParams.set('client_id', booking.client_id);
      availUrl.searchParams.set('date', toLocalDateStr(suggested));
      if (booking.service_id) availUrl.searchParams.append('service_ids', booking.service_id);
      if (booking.staff_id) availUrl.searchParams.set('staff_id', booking.staff_id);
      const availRes = await fetch(availUrl.toString());
      const availJson = availRes.ok ? await availRes.json() : { slots: [] };
      const match = (availJson.slots ?? []).find(
        (s: { starts_at: string; available: boolean }) => s.available && new Date(s.starts_at).getTime() === suggested.getTime()
      );

      if (match) {
        router.push({
          pathname: '/booking/review',
          params: {
            ...baseParams,
            staffId: booking.staff_id ?? '',
            staffName,
            startsAt: match.starts_at,
            endsAt: match.ends_at,
            rebookSource: 'rebook_nudge',
          },
        } as never);
      } else {
        router.push({
          pathname: '/booking/staff',
          params: {
            ...baseParams,
            ...(booking.staff_id ? { prefillStaffId: booking.staff_id } : {}),
            prefillStartsAt: suggested.toISOString(),
          },
        } as never);
      }
    } catch {
      router.push({ pathname: '/(tabs)/my-booking' });
    }
  }

  // "Are You Here?" card's 4 options -- every one of them notifies the
  // salon (dashboard bell + push), same as check-in already did and the
  // self-cancel route already does; eta-status is a new lightweight
  // endpoint just for the "Almost"/"Running Late" pings, since there's no
  // booking-row state to track for those (unlike checked_in_at/cancelled).
  async function handleCheckinOption(item: NotificationItem, option: 'here' | 'almost' | 'running_late' | 'cancel') {
    if (!item.booking_id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };

    if (option === 'cancel') {
      Alert.alert(
        'Cancel this appointment?',
        'This will let the salon know you’re not coming.',
        [
          { text: 'Keep appointment', style: 'cancel' },
          {
            text: 'Cancel appointment',
            style: 'destructive',
            onPress: async () => {
              await fetch(`${API_BASE}/api/mobile/bookings/${item.booking_id}/cancel`, { method: 'POST', headers, body: '{}' });
              setCheckinSentFor((prev) => ({ ...prev, [item.id]: 'Cancelled' }));
              load();
            },
          },
        ]
      );
      return;
    }

    if (option === 'here') {
      await fetch(`${API_BASE}/api/mobile/bookings/${item.booking_id}/check-in`, { method: 'POST', headers });
      setCheckinSentFor((prev) => ({ ...prev, [item.id]: "You're checked in" }));
      return;
    }

    await fetch(`${API_BASE}/api/mobile/bookings/${item.booking_id}/eta-status`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: option }),
    });
    setCheckinSentFor((prev) => ({ ...prev, [item.id]: option === 'almost' ? "Salon notified — almost there" : 'Salon notified — running late' }));
  }

  async function handlePress(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      await markNotificationRead(item.id);
    }
    if (item.type === 'balance_due' && item.booking_id) {
      router.push({ pathname: '/booking/pay-existing', params: { bookingId: item.booking_id } } as never);
      return;
    }
    if (item.type === 'rebook_nudge') {
      await handleRebookPress(item);
      return;
    }
    if (item.type === 'app_update') {
      if (!STORE_URL) return;
      const canOpen = await Linking.canOpenURL(STORE_URL);
      Linking.openURL(canOpen ? STORE_URL : STORE_URL_FALLBACK);
      return;
    }
    if (item.booking_id) {
      router.push({ pathname: '/(tabs)/my-booking', params: { highlightBookingId: item.booking_id } });
    }
  }

  const todayItems = items.filter((n) => isToday(n.created_at));
  const earlierItems = items.filter((n) => !isToday(n.created_at));

  // "Payment needed" gets its own hero treatment instead of the generic
  // category card -- it's the highest-stakes CTA in the inbox (an
  // appointment isn't confirmed until this is paid), so it earns a gold
  // celebratory glow and an embedded Pay Now button rather than blending
  // in with everything else.
  function renderBalanceDueCard(item: NotificationItem) {
    const apptDateTime = extractApptDateTime(item.body);
    return (
      <ImageBackground
        key={item.id}
        source={require('../../assets/images/notifications/pay-now-card-bg.png')}
        style={styles.heroCard}
        imageStyle={styles.heroCardBgImage}>
        <BreathingImage
          source={require('../../assets/images/notifications/credit-card-icon.png')}
          style={styles.heroCardDecoration}
          rotateDeg="20deg"
        />
        <View style={styles.heroBody}>
          <View style={styles.heroLeftCol}>
            <BreathingImage
              source={require('../../assets/images/notifications/calendar-check-icon.png')}
              style={styles.heroIconImage}
            />
            <Text style={styles.heroTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <View style={styles.heroRightCol}>
            <Pressable onPress={() => handlePress(item)}>
              <Text style={styles.heroTitle}>You&rsquo;re Almost Booked! 🎉</Text>
              {apptDateTime ? (
                <>
                  <Text style={styles.heroSubtitle}>Complete your payment to confirm your appointment on</Text>
                  <View style={styles.heroDateRow}>
                    <Ionicons name="calendar-outline" size={15} color="#B762F0" />
                    <Text style={styles.heroDateText}>{apptDateTime}.</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.heroSubtitle}>{item.body}</Text>
              )}
            </Pressable>
            <HeroGoldButton onPress={() => handlePress(item)} label="Pay Now" iconName="lock-closed" />
          </View>
        </View>
      </ImageBackground>
    );
  }

  // Mirrors renderBalanceDueCard's exact component tree -- ImageBackground
  // with an absolute close-X (top right), a left icon+timestamp column, and
  // a right column wrapped in its own Pressable for navigation -- so the
  // Cancelled hero card behaves and lays out identically to the Pay Now one.
  function renderCancelledCard(item: NotificationItem) {
    const category = categoryFor(item.type);
    const style = CATEGORY_STYLES[category];
    const cancelledDateTime = extractApptDateTime(item.body);

    return (
      <ImageBackground
        key={item.id}
        source={require('../../assets/images/notifications/cancelled-card-bg.png')}
        style={[styles.card, styles.cancelledCardSize, { height: cancelledCardHeight }]}
        imageStyle={styles.cancelledCardBgImage}>
        <View style={styles.heroBody}>
          <View style={styles.cancelledLeftCol}>
            <BreathingImage
              source={require('../../assets/images/notifications/cancelled-calendar-icon.png')}
              style={styles.cancelledIconImage}
            />
            <Text style={[styles.cancelledTime, { color: style.accent }]}>{timeAgo(item.created_at)}</Text>
          </View>
          <View style={styles.heroRightCol}>
            <Pressable onPress={() => handlePress(item)}>
              <Text style={styles.cancelledTitle} numberOfLines={1}>{item.title}</Text>
              {cancelledDateTime ? (
                <>
                  <Text style={[styles.cardBody, { marginTop: 6 }]}>Your appointment has been cancelled.</Text>
                  <View style={styles.cancelledDateRow}>
                    <Ionicons name="calendar-outline" size={15} color="#FF4D4D" />
                    <Text style={[styles.cancelledDateText, { color: '#FF4D4D' }]}>{cancelledDateTime}.</Text>
                  </View>
                </>
              ) : (
                <Text style={[styles.cardBody, { marginTop: 6 }]}>{item.body}</Text>
              )}
            </Pressable>
            <HeroGoldButton onPress={() => handlePress(item)} label="Rebook" iconName="refresh" />
          </View>
        </View>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: style.accent }]} />}
      </ImageBackground>
    );
  }

  // Same structure as Pay Now/Cancelled: a plain lead-in line, then the
  // date/time on its own line with a small calendar icon, when the body
  // has one embedded. Falls back to the raw body as a single line when it
  // doesn't (e.g. receipt, which has no date at all).
  function renderHeroDateBlock(item: NotificationItem, accent: string, subtitle?: string) {
    // Rescheduled bodies carry both the old and new date/time -- show the
    // old one inline in the lead-in line, and highlight only the new one.
    if (item.type === 'rescheduled') {
      const [fromDateTime, toDateTime] = extractAllApptDateTimes(item.body);
      if (fromDateTime && toDateTime) {
        return (
          <>
            <Text style={[styles.cardBody, { marginTop: 6 }]}>
              Your appointment {fromDateTime} has been rescheduled to
            </Text>
            <AnimatedDateRow dateTime={toDateTime} color={accent} rowStyle={styles.cancelledDateRow} textStyle={styles.cancelledDateText} />
          </>
        );
      }
    }

    const dateTime = extractApptDateTime(item.body);
    if (dateTime) {
      return (
        <>
          <Text style={[styles.cardBody, { marginTop: 6 }]}>{subtitle ?? item.body}</Text>
          <AnimatedDateRow dateTime={dateTime} color={accent} rowStyle={styles.cancelledDateRow} textStyle={styles.cancelledDateText} />
        </>
      );
    }

    // No full weekday/date in this body (e.g. "starts in 2 hours. See you
    // at 9:30 AM." or "...is tomorrow at 9:30 AM.") -- still pull a
    // highlighted row out of it, keeping the whole "See you at .../tomorrow
    // at ..." clause together on that row (not just the bare time) so
    // every hero card gets the same calendar-icon treatment.
    const timeOnly = extractApptTimeOnly(item.body);
    if (timeOnly) {
      const clauseStarts = ['See you at', 'tomorrow at', 'starts at'];
      const clauseIdx = clauseStarts
        .map((phrase) => item.body.indexOf(phrase))
        .find((i) => i >= 0);
      const splitIdx = clauseIdx !== undefined ? clauseIdx : item.body.indexOf(timeOnly);
      const lead = item.body.slice(0, splitIdx).replace(/\s+$/, '');
      const rawRowText = item.body.slice(splitIdx, item.body.indexOf(timeOnly) + timeOnly.length);
      const rowText = rawRowText.charAt(0).toUpperCase() + rawRowText.slice(1);
      return (
        <>
          <Text style={[styles.cardBody, { marginTop: 6 }]}>{lead}</Text>
          <AnimatedDateRow dateTime={rowText} color={accent} rowStyle={styles.cancelledDateRow} textStyle={styles.cancelledDateText} />
        </>
      );
    }

    return <Text style={[styles.cardBody, { marginTop: 6 }]}>{item.body}</Text>;
  }

  function renderGenericHeroCard(item: NotificationItem) {
    const category = categoryFor(item.type);
    const style = CATEGORY_STYLES[category];
    const config = HERO_CARD_CONFIG[item.type];
    const title = config?.title ?? item.title;
    const bgSource = config?.bg ?? require('../../assets/images/notifications/pay-now-card-bg.png');
    const iconName = TYPE_ICON[item.type] ?? style.icon;
    const accent = config?.accent ?? style.accent;

    const hasButton = !!config?.buttonLabel;
    const iconBlock = config?.iconImage ? (
      <BreathingImage source={config.iconImage} style={styles.cancelledIconImage} />
    ) : (
      <View style={[styles.genericIconBadge, { borderColor: accent }]}>
        <Ionicons name={iconName} size={26} color={accent} />
      </View>
    );
    const textBlock = (
      <>
        <Text style={styles.cancelledTitle} numberOfLines={1}>{title}</Text>
        {renderHeroDateBlock(item, accent, config?.subtitle)}
      </>
    );

    if (item.type === 'checkin_ready') {
      const sent = checkinSentFor[item.id];
      return (
        <ImageBackground key={item.id} source={bgSource} style={[styles.card, styles.cancelledCardSize]} imageStyle={styles.cancelledCardBgImage}>
          <View style={styles.heroBody}>
            <View style={styles.cancelledLeftCol}>
              {iconBlock}
              <Text style={[styles.cancelledTime, { color: accent }]}>{timeAgo(item.created_at)}</Text>
            </View>
            <View style={styles.heroRightCol}>
              {textBlock}
              {sent ? (
                <View style={styles.checkinSentRow}>
                  <Ionicons name="checkmark-circle" size={16} color={accent} />
                  <Text style={[styles.checkinSentText, { color: accent }]}>{sent}</Text>
                </View>
              ) : (
                <View style={styles.checkinOptionsGrid}>
                  <Pressable style={[styles.checkinOptionBtn, { backgroundColor: '#3DD68C' }]} onPress={() => handleCheckinOption(item, 'here')}>
                    <Text style={styles.checkinOptionText}>Here</Text>
                  </Pressable>
                  <Pressable style={[styles.checkinOptionBtn, { backgroundColor: accent }]} onPress={() => handleCheckinOption(item, 'almost')}>
                    <Text style={styles.checkinOptionText}>Almost</Text>
                  </Pressable>
                  <Pressable style={[styles.checkinOptionBtn, { backgroundColor: '#FF8A5C' }]} onPress={() => handleCheckinOption(item, 'running_late')}>
                    <Text style={styles.checkinOptionText}>Running Late</Text>
                  </Pressable>
                  <Pressable style={[styles.checkinOptionBtn, styles.checkinCancelBtn]} onPress={() => handleCheckinOption(item, 'cancel')}>
                    <Text style={[styles.checkinOptionText, styles.checkinCancelText]}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: accent, right: 12 }]} />}
        </ImageBackground>
      );
    }

    if (hasButton) {
      return (
        <ImageBackground key={item.id} source={bgSource} style={[styles.card, styles.cancelledCardSize]} imageStyle={styles.cancelledCardBgImage}>
          <View style={styles.heroBody}>
            <View style={styles.cancelledLeftCol}>
              {iconBlock}
              <Text style={[styles.cancelledTime, { color: accent }]}>{timeAgo(item.created_at)}</Text>
            </View>
            <View style={styles.heroRightCol}>
              <Pressable onPress={() => handlePress(item)}>{textBlock}</Pressable>
              <HeroGoldButton onPress={() => handlePress(item)} label={config!.buttonLabel!} iconName={config!.buttonIcon ?? 'refresh'} />
            </View>
          </View>
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: accent, right: 12 }]} />}
        </ImageBackground>
      );
    }

    return (
      <Pressable key={item.id} onPress={() => handlePress(item)}>
        <ImageBackground source={bgSource} style={[styles.card, styles.cancelledCardSize]} imageStyle={styles.cancelledCardBgImage}>
          <View style={styles.heroBody}>
            <View style={styles.cancelledLeftCol}>
              {iconBlock}
              <Text style={[styles.cancelledTime, { color: accent }]}>{timeAgo(item.created_at)}</Text>
            </View>
            <View style={styles.heroRightCol}>{textBlock}</View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" style={styles.genericChevron} />
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: accent, right: 38 }]} />}
        </ImageBackground>
      </Pressable>
    );
  }

  function renderCard(item: NotificationItem) {
    if (item.type === 'balance_due') return renderBalanceDueCard(item);
    if (item.type === 'cancelled') return renderCancelledCard(item);
    if (HERO_CARD_CONFIG[item.type]) return renderGenericHeroCard(item);

    const category = categoryFor(item.type);
    const style = CATEGORY_STYLES[category];
    const icon = TYPE_ICON[item.type] ?? style.icon;

    return (
      <Pressable
        key={item.id}
        onPress={() => handlePress(item)}>
        {({ pressed }) => (
          <LinearGradient
            colors={style.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.card, pressed && { opacity: 0.9 }]}>
            <View style={[styles.iconBadge, { backgroundColor: style.iconBg }]}>
              <Ionicons name={icon} size={24} color={style.iconColor} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={[styles.cardTime, { color: style.accent }]}>{timeAgo(item.created_at)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.5)" />
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: style.accent }]} />}
          </LinearGradient>
        )}
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F4D77A" />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <BreathingHeart size={40} color="#F4D77A" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="notifications-off-outline" size={48} color="rgba(255,255,255,0.4)" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#F4D77A" colors={['#F4D77A']} />
          }>
          {todayItems.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Today</Text>
              {todayItems.map(renderCard)}
            </>
          )}
          {earlierItems.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Earlier</Text>
              {earlierItems.map(renderCard)}
            </>
          )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.lg,
    color: '#FFFFFF',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },

  list: { padding: Spacing.md, gap: Spacing.sm },
  sectionLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: 16,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  cancelledCardBgImage: {
    borderRadius: 22,
    resizeMode: 'stretch',
  },
  cancelledCardSize: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelledIconImage: {
    width: 60,
    height: 60,
    marginTop: 22,
    resizeMode: 'contain',
  },
  cancelledLeftCol: {
    width: 66,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  cancelledTime: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  cancelledDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  cancelledDateText: {
    fontFamily: FontFamily.soraBold,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.3,
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  cancelledTitle: {
    fontFamily: FontFamily.soraBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  cardBody: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: FontSize.sm * 1.4,
  },
  cardTime: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  genericIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  genericChevron: {
    position: 'absolute',
    top: 16,
    right: 14,
  },
  checkinOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  checkinOptionBtn: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinOptionText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xs,
    color: '#09000F',
  },
  checkinCancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  checkinCancelText: {
    color: 'rgba(255,255,255,0.75)',
  },
  checkinSentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  checkinSentText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
  },

  heroCard: {
    position: 'relative',
    borderRadius: 24,
    padding: 16,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  heroCardBgImage: {
    borderRadius: 24,
    resizeMode: 'stretch',
  },
  heroBody: {
    flexDirection: 'row',
    gap: Spacing.sm,
    zIndex: 1,
  },
  heroLeftCol: {
    width: 66,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  heroIconImage: {
    width: 60,
    height: 60,
    marginTop: 22,
    resizeMode: 'contain',
  },
  heroRightCol: {
    flex: 1,
    gap: 8,
    paddingRight: 8,
  },
  heroCardDecoration: {
    position: 'absolute',
    width: 68,
    height: 46,
    right: 12,
    bottom: 34,
    resizeMode: 'contain',
    zIndex: 0,
  },
  heroTitle: {
    fontFamily: FontFamily.soraBold,
    fontSize: 16,
    color: '#F4D77A',
  },
  heroSubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: FontSize.sm * 1.4,
    marginTop: 6,
  },
  heroDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroDateText: {
    fontFamily: FontFamily.soraBold,
    fontSize: FontSize.xs,
    color: '#B762F0',
    lineHeight: FontSize.xs * 1.3,
  },
  heroTime: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  heroPayBtnWrap: {
    alignSelf: 'flex-start',
    minWidth: '78%',
    zIndex: 1,
  },
  heroPayBtnClip: {
    position: 'relative',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  heroPayBtnShine: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 40,
  },
  heroPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  heroPayBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
});
