import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { InvisibleRefreshControl, RefreshHeartOverlay } from '@/components/PullToRefreshHeart';
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

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  booking_confirmed: 'checkmark-circle-outline',
  reminder_24h:       'time-outline',
  reminder_2h:        'alarm-outline',
  rescheduled:        'calendar-outline',
  cancelled:          'close-circle-outline',
};

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
    if (item.booking_id) {
      router.push({ pathname: '/(tabs)/my-booking', params: { highlightBookingId: item.booking_id } });
    }
  }

  async function handleDelete(item: NotificationItem) {
    setItems((prev) => prev.filter((n) => n.id !== item.id));
    await deleteNotification(item.id);
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
        <View style={{ flex: 1 }}>
        <RefreshHeartOverlay refreshing={refreshing} />
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<InvisibleRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              onLongPress={() => handleDelete(item)}>
              {({ pressed }) => (
                <BlurView
                  intensity={90}
                  tint="dark"
                  style={[styles.card, !item.read && styles.cardUnread, pressed && { opacity: 0.85 }]}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Ionicons
                    name={ICONS[item.type] ?? 'notifications-outline'}
                    size={22}
                    color="#F4D77A"
                  />
                  <View style={styles.cardText}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardBody}>{item.body}</Text>
                    <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                  {!item.read && <View style={styles.unreadDot} />}
                </BlurView>
              )}
            </Pressable>
          )}
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
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: Spacing.sm,
  },
  cardUnread: {
    borderColor: '#F4D77A',
  },
  cardText: { flex: 1, gap: 2 },
  cardTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  cardBody: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    lineHeight: FontSize.sm * 1.4,
  },
  cardTime: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#F4D77A',
    marginTop: 6,
  },
});
