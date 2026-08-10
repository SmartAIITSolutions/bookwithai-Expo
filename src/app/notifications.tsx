import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl, Image, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import {
  fetchNotifications, markNotificationRead, deleteNotification,
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

function categoryFor(type: string): Category {
  return TYPE_CATEGORY[type] ?? 'updates';
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  async function handlePress(item: NotificationItem) {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      await markNotificationRead(item.id);
    }
    if (item.type === 'balance_due' && item.booking_id) {
      router.push({ pathname: '/booking/pay-existing', params: { bookingId: item.booking_id } } as never);
      return;
    }
    if (item.booking_id) {
      router.push({ pathname: '/(tabs)/my-booking', params: { highlightBookingId: item.booking_id } });
    }
  }

  async function handleDelete(item: NotificationItem) {
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    await deleteNotification(item.id);
  }

  const todayItems = items.filter((n) => isToday(n.created_at));
  const earlierItems = items.filter((n) => !isToday(n.created_at));

  // "Payment needed" gets its own hero treatment instead of the generic
  // category card -- it's the highest-stakes CTA in the inbox (an
  // appointment isn't confirmed until this is paid), so it earns a gold
  // celebratory glow and an embedded Pay Now button rather than blending
  // in with everything else.
  function renderBalanceDueCard(item: NotificationItem) {
    return (
      <ImageBackground
        key={item.id}
        source={require('../../assets/images/notifications/pay-now-card-bg.png')}
        style={styles.heroCard}
        imageStyle={styles.heroCardBgImage}>
        <Pressable onPress={() => handleDelete(item)} style={styles.heroCloseBtn} hitSlop={8}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
        <Pressable onPress={() => handlePress(item)} style={styles.heroTop}>
          <Image
            source={require('../../assets/images/notifications/calendar-check-icon.png')}
            style={styles.heroIconImage}
          />
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>You're Almost Booked! 🎉</Text>
            <Text style={styles.heroSubtitle}>Complete your payment to confirm your appointment.</Text>
            <Text style={styles.heroDetail}>{item.body}</Text>
          </View>
        </Pressable>
        <Text style={styles.heroTime}>{timeAgo(item.created_at)}</Text>
        <Pressable onPress={() => handlePress(item)} style={styles.heroPayBtn}>
          <Ionicons name="lock-closed" size={16} color="#09000F" />
          <Text style={styles.heroPayBtnText}>Pay Now</Text>
          <Ionicons name="chevron-forward" size={16} color="#09000F" />
        </Pressable>
        <Image
          source={require('../../assets/images/notifications/credit-card-icon.png')}
          style={styles.heroCardDecoration}
        />
      </ImageBackground>
    );
  }

  function renderCard(item: NotificationItem) {
    if (item.type === 'balance_due') return renderBalanceDueCard(item);

    const category = categoryFor(item.type);
    const style = CATEGORY_STYLES[category];
    const icon = TYPE_ICON[item.type] ?? style.icon;

    return (
      <Pressable
        key={item.id}
        onPress={() => handlePress(item)}
        onLongPress={() => handleDelete(item)}>
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
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
  cardTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
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

  heroCard: {
    position: 'relative',
    borderRadius: 24,
    padding: 18,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    shadowColor: '#F4D77A',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  heroCardBgImage: {
    borderRadius: 24,
    resizeMode: 'cover',
  },
  heroCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 2,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingRight: 28,
    zIndex: 1,
  },
  heroIconImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  heroText: { flex: 1, gap: 4 },
  heroCardDecoration: {
    position: 'absolute',
    width: 84,
    height: 56,
    right: 6,
    top: 62,
    resizeMode: 'contain',
    opacity: 0.85,
    transform: [{ rotate: '-10deg' }],
    zIndex: -1,
  },
  heroTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.md,
    color: '#F4D77A',
    textShadowColor: 'rgba(244,215,122,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  heroSubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: FontSize.sm * 1.4,
  },
  heroDetail: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#C9B8FF',
    lineHeight: FontSize.sm * 1.4,
  },
  heroTime: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  heroPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F4D77A',
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
  },
  heroPayBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
});
