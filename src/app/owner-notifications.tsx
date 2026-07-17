import { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack, router } from 'expo-router';
import { listNotifications, markNotificationRead, markAllNotificationsRead, OwnerNotification } from '@/lib/api/ownerNotifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { Colors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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
      <Stack.Screen options={{
        title: 'Notifications',
        headerRight: () => (
          <TouchableOpacity onPress={handleMarkAll}><Text style={styles.markAllText}>Mark all read</Text></TouchableOpacity>
        ),
      }} />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={Colors.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyHint}>You're all caught up.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} onPress={() => handlePress(item)}>
              {!item.read && <View style={styles.dot} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body}>{item.body}</Text>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markAllText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing['2xl'] },
  emptyHint: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing['2xl'] },
  row: { flexDirection: 'row', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.subtle },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: Colors.primary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 6 },
  title: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  body: { fontSize: 13.5, color: Colors.textSecondary, marginTop: 2 },
  time: { fontSize: 11.5, color: Colors.textDisabled, marginTop: 4 },
});
