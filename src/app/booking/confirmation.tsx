/**
 * Booking Confirmation — Steps 13 + 15
 *
 * - Shows confirmation details
 * - Add to Calendar via expo-calendar (run: npx expo install expo-calendar)
 * - Get Directions via Linking to maps
 */
import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Linking, Platform, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import * as Calendar from 'expo-calendar/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { notificationSuccess } from '@/hooks/usePressHaptic';
import { requestAndRegisterPushToken } from '@/lib/push/registerForPushNotifications';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

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
    bookingId, customerId, paid,
  } = useLocalSearchParams<{
    salonId: string; salonSlug: string; salonName: string;
    serviceNames: string; totalCents: string;
    staffName: string;
    startsAt: string; endsAt: string;
    bookingId: string; customerId: string; paid: string;
  }>();

  const [calAdded, setCalAdded] = useState(false);

  const services = (serviceNames || '').split('||').filter(Boolean);
  const cents = parseInt(totalCents || '0', 10);
  const wasPaid = paid !== 'false';

  // Ask for notification permission on every confirmed booking.
  // requestAndRegisterPushToken() already only calls the real permission API
  // when status isn't 'granted', and Android itself only ever shows the
  // actual system dialog the true first time — after a decision (granted or
  // denied) it silently no-ops on every call after. That naturally gives us
  // "ask once" without needing to track it ourselves, and avoids the ambiguity
  // between "never asked" and "denied" that a pre-check status read has.
  useEffect(() => {
    requestAndRegisterPushToken(customerId || undefined);
  }, []);

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

  async function handleShare() {
    const when = startsAt ? formatLongDateTime(startsAt) : '';
    const lines = [
      `${salonName || 'My appointment'}`,
      when,
      services.join(', '),
      staffName ? `with ${staffName}` : null,
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      // user cancelled or share sheet failed silently -- nothing to recover from
    }
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Success icon */}
        <View style={styles.successWrap}>
          <Canvas style={styles.successGlow} pointerEvents="none">
            <Circle cx={60} cy={60} r={60}>
              <RadialGradient
                c={vec(60, 60)}
                r={60}
                colors={['rgba(212,175,55,0.35)', 'rgba(212,175,55,0)']}
              />
            </Circle>
            <Circle cx={60} cy={60} r={48} style="stroke" strokeWidth={2} color="#F4D77A">
              <BlurMask blur={6} style="solid" />
            </Circle>
          </Canvas>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={48} color="#09000F" />
          </View>
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
          <CardOverlay />
          <Text style={styles.detailCardTitle}>{salonName}</Text>

          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={18} color="#F4D77A" />
            <Text style={styles.detailText}>{startsAt ? formatLongDateTime(startsAt) : '—'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color="#F4D77A" />
            <Text style={styles.detailText}>{staffName || 'Any Available'}</Text>
          </View>

          {services.map((s, i) => (
            <View key={i} style={styles.detailRow}>
              <Ionicons name="cut-outline" size={18} color="#F4D77A" />
              <Text style={styles.detailText}>{s}</Text>
            </View>
          ))}

          {cents > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{wasPaid ? 'Paid' : 'Due at Salon'}</Text>
                <Text style={styles.priceValue}>
                  {formatPrice(cents)}
                </Text>
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
              color={calAdded ? '#7ED9A0' : '#F4D77A'}
            />
            <Text style={[styles.actionBtnText, calAdded && styles.actionBtnTextDone]}>
              {calAdded ? 'Added to Calendar' : 'Add to Calendar'}
            </Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleGetDirections}>
            <Ionicons name="navigate-outline" size={20} color="#F4D77A" />
            <Text style={styles.actionBtnText}>Get Directions</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#F4D77A" />
            <Text style={styles.actionBtnText}>Share</Text>
          </Pressable>
        </View>

        {/* Done button */}
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: {
    padding: Spacing.xl,
    alignItems: 'center',
  },

  successWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  successGlow: { position: 'absolute', width: 120, height: 120 },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F4D77A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  headline: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize['3xl'],
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  subheadline: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
    marginBottom: Spacing.sm,
  },
  bookingRef: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: Spacing.xl,
    letterSpacing: 0.5,
  },

  detailCard: {
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    overflow: 'hidden',
  },
  detailCardTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.25)',
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
    color: 'rgba(255,255,255,0.6)',
  },
  priceValue: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: '#F4D77A',
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  actionBtnDone: {
    borderColor: '#7ED9A0',
    backgroundColor: 'rgba(126,217,160,0.1)',
  },
  actionBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#F4D77A',
  },
  actionBtnTextDone: {
    color: '#7ED9A0',
  },

  doneBtn: {
    width: '100%',
    backgroundColor: '#F4D77A',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#09000F',
  },
});
