import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchStaffAppointments, fetchStaffShifts, staffClock, StaffAppointment } from '@/lib/api/staffApi';
import { notificationSuccess, notificationError } from '@/hooks/usePressHaptic';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()} · ${h}:${m} ${ampm}`;
}

export default function StaffScheduleScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [scope, setScope] = useState<'own' | 'all'>('own');
  const [clockedIn, setClockedIn] = useState(false);
  const [clocking, setClocking] = useState(false);

  const load = useCallback(async () => {
    const [apptResult, shiftsResult] = await Promise.all([fetchStaffAppointments(), fetchStaffShifts()]);
    if (apptResult.ok) {
      setAppointments(apptResult.data.data);
      setScope(apptResult.data.scope);
    }
    if (shiftsResult.ok) {
      const latest = shiftsResult.data.data[0];
      setClockedIn(!!latest && !latest.clock_out_at);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleClock() {
    setClocking(true);
    const result = await staffClock(clockedIn ? 'out' : 'in');
    setClocking(false);
    if (result.ok) {
      notificationSuccess();
      setClockedIn(!clockedIn);
    } else {
      notificationError();
      Alert.alert('Could not clock in/out', result.error);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Schedule</Text>
      </View>

      <Pressable style={[styles.clockBtn, clockedIn && styles.clockBtnActive]} onPress={handleClock} disabled={clocking}>
        {clocking ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <>
            <Ionicons name={clockedIn ? 'stop-circle-outline' : 'play-circle-outline'} size={22} color={Colors.white} />
            <Text style={styles.clockBtnText}>{clockedIn ? 'Clock Out' : 'Clock In'}</Text>
          </>
        )}
      </Pressable>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="calendar-outline" size={48} color={Colors.textDisabled} />
          <Text style={styles.emptyTitle}>Nothing on the books</Text>
          <Text style={styles.emptySubtitle}>
            {scope === 'all' ? "No upcoming appointments for the salon." : "You don't have any upcoming appointments."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
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
              {item.customer?.name && (
                <View style={styles.cardRow}>
                  <Ionicons name="person-outline" size={14} color={Colors.primary} />
                  <Text style={styles.cardDetail}>{item.customer.name}</Text>
                </View>
              )}
              {scope === 'all' && item.staff?.name && (
                <View style={styles.cardRow}>
                  <Ionicons name="people-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.cardDetailMuted}>{item.staff.name}</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  header: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize['2xl'], color: Colors.textPrimary },
  clockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.xl, marginBottom: Spacing.md,
    backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md,
    ...Shadows.button,
  },
  clockBtnActive: { backgroundColor: Colors.error },
  clockBtnText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.md, color: Colors.white },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyTitle: { fontFamily: FontFamily.frauncesBold, fontSize: FontSize.xl, color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontFamily: FontFamily.sora, fontSize: FontSize.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: FontSize.base * 1.6 },
  list: { padding: Spacing.xl, gap: Spacing.md },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, ...Shadows.card },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  cardDetail: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: Colors.textSecondary },
  cardDetailMuted: { fontFamily: FontFamily.sora, fontSize: FontSize.xs, color: Colors.textDisabled },
});
