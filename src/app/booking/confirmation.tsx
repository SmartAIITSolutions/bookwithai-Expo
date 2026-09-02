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
import { formatCentsUSD, formatFullDateTime } from '@/lib/i18n/format';
import { useTranslation } from 'react-i18next';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const formatPrice = formatCentsUSD;

function formatLongDateTime(isoStr: string) {
  return formatFullDateTime(new Date(isoStr));
}

async function getDefaultCalendarId(): Promise<string | null> {
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const def = cals.find((c) => c.isPrimary) ?? cals[0];
  return def?.id ?? null;
}

export default function ConfirmationScreen() {
  const { t } = useTranslation(['booking']);
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
        Alert.alert(t('booking:confirmationScreen.permissionNeededTitle'), t('booking:confirmationScreen.calendarPermissionMessage'));
        return;
      }

      const calId = await getDefaultCalendarId();
      if (!calId) {
        Alert.alert(t('booking:confirmationScreen.errorTitle'), t('booking:confirmationScreen.noCalendarFound'));
        return;
      }

      const start = new Date(startsAt);
      const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 60 * 60 * 1000);

      await Calendar.createEventAsync(calId, {
        title: t('booking:confirmationScreen.eventTitle', { services: services.join(', '), salonName }),
        startDate: start,
        endDate: end,
        notes: staffName ? t('booking:confirmationScreen.eventNotesWith', { name: staffName }) : undefined,
        alarms: [{ relativeOffset: -60 }], // 1-hour reminder
      });

      setCalAdded(true);
      notificationSuccess();
      Alert.alert(t('booking:confirmationScreen.addedTitle'), t('booking:confirmationScreen.addedMessage'));
    } catch (e: any) {
      Alert.alert(t('booking:confirmationScreen.errorTitle'), e.message || t('booking:confirmationScreen.couldNotAddToCalendar'));
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
      `${salonName || t('booking:confirmationScreen.shareDefaultTitle')}`,
      when,
      services.join(', '),
      staffName ? t('booking:confirmationScreen.shareWith', { name: staffName }) : null,
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

        <Text style={styles.headline}>{t('booking:confirmationScreen.headline')}</Text>
        <Text style={styles.subheadline}>
          {t('booking:confirmationScreen.subheadline')}
        </Text>

        {/* Booking ref */}
        {bookingId ? (
          <Text style={styles.bookingRef}>{t('booking:confirmationScreen.bookingRef', { ref: bookingId.slice(0, 8).toUpperCase() })}</Text>
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
            <Text style={styles.detailText}>{staffName || t('booking:staffScreen.anyAvailable')}</Text>
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
                <Text style={styles.priceLabel}>{wasPaid ? t('booking:confirmationScreen.paid') : t('booking:confirmationScreen.dueAtSalon')}</Text>
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
              {calAdded ? t('booking:confirmationScreen.addedToCalendar') : t('booking:confirmationScreen.addToCalendar')}
            </Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleGetDirections}>
            <Ionicons name="navigate-outline" size={20} color="#F4D77A" />
            <Text style={styles.actionBtnText}>{t('booking:confirmationScreen.getDirections')}</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="#F4D77A" />
            <Text style={styles.actionBtnText}>{t('booking:confirmationScreen.share')}</Text>
          </Pressable>
        </View>

        {/* Done button */}
        <Pressable style={styles.doneBtn} onPress={handleDone}>
          <Text style={styles.doneBtnText}>{t('booking:confirmationScreen.done')}</Text>
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
