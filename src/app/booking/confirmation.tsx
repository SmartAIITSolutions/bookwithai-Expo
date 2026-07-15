/**
 * Booking Confirmation — Steps 13 + 15
 *
 * - Shows confirmation details
 * - Add to Calendar via expo-calendar (run: npx expo install expo-calendar)
 * - Get Directions via Linking to maps
 */
import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar';
import { notificationSuccess } from '@/hooks/usePressHaptic';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatLongDateTime(isoStr: string) {
  const d = new Date(isoStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} at ${h}:${m} ${ampm}`;
}

async function getDefaultCalendarId(): Promise<string | null> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const def = cals.find((c) => c.isPrimary) ?? cals[0];
  return def?.id ?? null;
}

export default function ConfirmationScreen() {
  const {
    salonId, salonSlug, salonName,
    serviceNames, totalCents,
    staffName,
    startsAt, endsAt,
    bookingId,
  } = useLocalSearchParams<{
    salonId: string; salonSlug: string; salonName: string;
    serviceNames: string; totalCents: string;
    staffName: string;
    startsAt: string; endsAt: string;
    bookingId: string;
  }>();

  const [calAdded, setCalAdded] = useState(false);

  const services = (serviceNames || '').split('||').filter(Boolean);
  const cents = parseInt(totalCents || '0', 10);

  async function handleAddToCalendar() {
    try {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Calendar access is needed to add this appointment.');
        return;
      }

      const calId = await getDefaultCalendarId();
      if (!calId) {
        Alert.alert('Error', 'No calendar found on this device.');
        return;
      }

      const start = new Date(startsAt);
      const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000);

      await Calendar.createEventAsync(calId, {
        title: `${services.join(', ')} at ${salonName}`,
        startDate: start,
        endDate: end,
        notes: staffName ? `with ${staffName}` : undefined,
        alarms: [{ relativeOffset: -60 }], // 1-hour reminder
      });

      setCalAdded(true);
      notificationSuccess();
      Alert.alert('Added!', 'Appointment added to your calendar.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add to calendar.');
    }
  }

  function handleGetDirections() {
    // Opens in Apple Maps (iOS) or Google Maps (Android)
    const query = encodeURIComponent(salonName || 'salon');
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${query}`
      : `geo:0,0?q=${query}`;
    Linking.openURL(url).catch(() => {
      // Fallback to web maps
      Linking.openURL(`https://maps.google.com/?q=${query}`);
    });
  }

  function handleDone() {
    router.replace('/(tabs)/my-booking');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Success icon */}
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={48} color={Colors.white} />
        </View>

        <Text style={styles.headline}>You're all booked!</Text>
        <Text style={styles.subheadline}>
          Your appointment has been confirmed. We'll see you soon.
        </Text>

        {/* Booking ref */}
        {bookingId ? (
          <Text style={styles.bookingRef}>Booking ref: #{bookingId.slice(0, 8).toUpperCase()}</Text>
        ) : null}

        {/* Details card */}
        <View style={styles.detailCard}>
          <Text style={styles.detailCardTitle}>{salonName}</Text>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.detailText}>{startsAt ? formatLongDateTime(startsAt) : '—'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color={Colors.primary} />
            <Text style={styles.detailText}>{staffName || 'Any Available'}</Text>
          </View>

          {services.map((s, i) => (
            <View key={i} style={styles.detailRow}>
              <Ionicons name="cut-outline" size={18} color={Colors.primary} />
              <Text style={styles.detailText}>{s}</Text>
            </View>
          ))}

          {cents > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Paid</Text>
                <Text style={styles.priceValue}>{formatPrice(cents)}</Text>
              </View>
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionBtn, calAdded && styles.actionBtnDone]}
            onPress={handleAddToCalendar}
            disabled={calAdded}>
            <Ionicons
              name={calAdded ? 'checkmark-circle' : 'calendar-outline'}
              size={20}
              color={calAdded ? Colors.success : Colors.primary}
            />
            <Text style={[styles.actionBtnText, calAdded && styles.actionBtnTextDone]}>
              {calAdded ? 'Added to Calendar' : 'Add to Calendar'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleGetDirections}>
            <Ionicons name="navigate-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionBtnText}>Get Directions</Text>
          </Pressable>
        </View>

        {/* Done button */}
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
  scrollContent: {
    padding: Spacing.xl,
    alignItems: 'center',
  },

  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },

  headline: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['3xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subheadline: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
    marginBottom: Spacing.sm,
  },
  bookingRef: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
    letterSpacing: 0.5,
  },

  detailCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    ...Shadows.card,
  },
  detailCardTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: Colors.success,
  },

  // Action buttons
  actions: {
    width: '100%',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.backgroundLavender,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  actionBtnDone: {
    borderColor: Colors.success,
    backgroundColor: '#F0FDF4',
  },
  actionBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },
  actionBtnTextDone: {
    color: Colors.success,
  },

  doneBtn: {
    width: '100%',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.button,
  },
  doneBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
