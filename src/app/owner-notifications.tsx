import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { listNotifications, markNotificationRead, markAllNotificationsRead, OwnerNotification } from '@/lib/api/ownerNotifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Phase 0.1 Notification Center — "one center, not popups." Realtime-backed
// (same pattern as Sprint 2's calendar) so a new booking/cancellation
// appears here instantly, on top of the actual push notification.
export default function OwnerNotificationsScreen() {
  const { clientId } = useAuth();
  const [items, setItems] = useState<OwnerNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await listNotifications();
    if (result.ok) setItems(result.data.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`owner-notifications:${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `client_id=eq.${clientId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clientId, load]);

  async function handlePress(n: OwnerNotification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems(list => list.map(x => x.id === n.id ? { ...x, read: true } : x));
    }
    if (n.booking_id) router.push('/(owner)/calendar' as never);
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    setItems(list => list.map(x => ({ ...x, read: true })));
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{
        title: 'Notifications',
        headerStyle: { backgroundColor: '#0B0712' },
        headerTintColor: '#F4D77A',
        headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
        headerRight: () => (
          <TouchableOpacity onPress={handleMarkAll}><Text style={styles.markAllText}>Mark all read</Text></TouchableOpacity>
        ),
      }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyHint}>You're all caught up.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => handlePress(item)}>
              <BlurView intensity={90} tint="dark" style={[styles.row, !item.read && styles.rowUnread]}>
                <CardOverlay />
                {!item.read && <View style={styles.dot} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.body}>{item.body}</Text>
                  <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
                </View>
              </BlurView>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markAllText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: Spacing['2xl'] },
  row: {
    flexDirection: 'row', gap: Spacing.sm,
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  rowUnread: { borderColor: '#F4D77A' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F4D77A', marginTop: 6 },
  title: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  body: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  time: { fontFamily: FontFamily.sora, fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 4 },
});
