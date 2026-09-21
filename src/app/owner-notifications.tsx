import { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { Stack, router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { listNotifications, markNotificationRead, markAllNotificationsRead, OwnerNotification } from '@/lib/api/ownerNotifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { FontFamily, FontSize, Spacing } from '@/constants/Theme';

// Standalone-instance pattern -- plain utility function, not a hook/component.
function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return i18n.t('owner:ownerNotificationsScreen.justNow');
  if (mins < 60) return i18n.t('owner:ownerNotificationsScreen.minutesAgo', { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return i18n.t('owner:ownerNotificationsScreen.hoursAgo', { count: hours });
  return i18n.t('owner:ownerNotificationsScreen.daysAgo', { count: Math.round(hours / 24) });
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
const ownerNotificationsQueryKey = ['owner-notifications'] as const;

export default function OwnerNotificationsScreen() {
  const { t } = useTranslation(['owner']);
  const { clientId } = useAuth();
  const queryClient = useQueryClient();
  // Perf pass — this screen is pushed onto the stack (not a tab), so it
  // fully unmounts/remounts on every visit -- its own `loading` state used
  // to reset to true and blank to a spinner every single time the bell
  // icon was tapped, even seconds after it was last closed. React Query's
  // cache lives on the shared QueryClient, outside this component's own
  // lifecycle, so a revisit now reads the still-fresh cached list
  // instantly (isLoading only true when there's genuinely no cached data
  // yet) while quietly re-validating in the background.
  const notificationsQuery = useQuery({
    queryKey: ownerNotificationsQueryKey,
    queryFn: async () => {
      const result = await listNotifications();
      if (!result.ok) throw new Error(result.error);
      return result.data.data;
    },
  });
  const items = notificationsQuery.data ?? [];
  const loading = notificationsQuery.isLoading;

  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel(`owner-notifications:${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `client_id=eq.${clientId}` }, () => notificationsQuery.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  async function handlePress(n: OwnerNotification) {
    if (!n.read) {
      await markNotificationRead(n.id);
      queryClient.setQueryData<OwnerNotification[]>(ownerNotificationsQueryKey, (prev) =>
        (prev ?? []).map(x => x.id === n.id ? { ...x, read: true } : x)
      );
    }
    // P10.11: SANAA deep links, reusing only existing screens -- no new
    // navigation architecture for notification routing.
    if (n.type === 'sanaa_transfer' || n.type === 'sanaa_live_call') {
      router.push('/owner-sanaa/calls' as never);
    } else if (n.type.startsWith('sanaa_usage_') || n.type === 'sanaa_payment_failed' || n.type === 'sanaa_suspended' || n.type === 'sanaa_cancel_scheduled' || n.type === 'sanaa_cancelled') {
      router.push('/owner-sanaa/billing' as never);
    } else if (n.booking_id) {
      router.push('/(owner)/calendar' as never);
    }
  }

  async function handleMarkAll() {
    await markAllNotificationsRead();
    queryClient.setQueryData<OwnerNotification[]>(ownerNotificationsQueryKey, (prev) =>
      (prev ?? []).map(x => ({ ...x, read: true }))
    );
  }

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <Stack.Screen options={{
        title: t('owner:ownerNotificationsScreen.title'),
        headerStyle: { backgroundColor: '#0B0712' },
        headerTintColor: '#F4D77A',
        headerTitleStyle: { fontFamily: FontFamily.frauncesBold, color: '#FFFFFF' },
        headerRight: () => (
          <TouchableOpacity onPress={handleMarkAll}><Text style={styles.markAllText}>{t('owner:ownerNotificationsScreen.markAllRead')}</Text></TouchableOpacity>
        ),
      }} />
      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={n => n.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyHint}>{t('owner:ownerNotificationsScreen.allCaughtUp')}</Text>}
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
