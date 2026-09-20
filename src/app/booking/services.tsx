import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import {
  fetchServicesBySalonId,
  groupServicesByCategory,
  formatPrice,
  formatDuration,
  type Service,
} from '@/lib/api/salon';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { ErrorState } from '@/components/ErrorState';
import { saveCustomerPreferences } from '@/lib/api/customer';
import { useAuth } from '@/lib/auth/AuthContext';
import { useTranslation } from 'react-i18next';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function ServicesScreen() {
  const { t } = useTranslation(['booking']);
  const { user } = useAuth();
  const {
    salonId, salonSlug, salonName, requireOnlinePayment,
    prefillServiceIds, prefillStaffId, prefillStartsAt, rebookSource,
  } = useLocalSearchParams<{
    salonId: string;
    salonSlug: string;
    salonName: string;
    requireOnlinePayment: string;
    // Rebook-nudge deep link only -- suggested picks, pre-selected but fully
    // editable at every step. Forwarded unchanged through the rest of the
    // flow so review/payment can tag the resulting booking's source.
    prefillServiceIds?: string;
    prefillStaffId?: string;
    prefillStartsAt?: string;
    rebookSource?: string;
  }>();

  interface CartLine { service: Service; qty: number }

  const [groups, setGroups] = useState<{ category: string; items: Service[] }[]>([]);
  // Tap-to-add cart, not single-select -- tapping a service already in the
  // cart adds another of it, matching the owner-side walk-in flow and
  // letting a customer book the same service twice (e.g. for a friend) or
  // combine several services into this one appointment.
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    if (!salonId) return;
    setLoading(true);
    setLoadError(false);
    fetchServicesBySalonId(salonId)
      .then((svcs) => {
        // Filter out bundle-only and non-online-bookable
        const bookable = svcs.filter(
          (s) => !s.bundle_only && s.bookable_online !== false
        );
        setGroups(groupServicesByCategory(bookable));
        if (prefillServiceIds) {
          const ids = prefillServiceIds.split(',').filter(Boolean);
          setCart(bookable.filter((s) => ids.includes(s.id)).map((service) => ({ service, qty: 1 })));
        }
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [salonId]);

  function addToCart(svc: Service) {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.service.id === svc.id);
      if (idx === -1) return [...prev, { service: svc, qty: 1 }];
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      return next;
    });
  }

  function removeFromCart(svcId: string) {
    setCart((prev) => prev.flatMap((l) => {
      if (l.service.id !== svcId) return [l];
      return l.qty <= 1 ? [] : [{ ...l, qty: l.qty - 1 }];
    }));
  }

  function qtyOf(svc: Service) {
    return cart.find((l) => l.service.id === svc.id)?.qty ?? 0;
  }

  const cartServiceIds = cart.flatMap((l) => Array(l.qty).fill(l.service.id));
  const cartCount = cart.reduce((sum, l) => sum + l.qty, 0);
  const totalCents = cart.reduce((sum, l) => sum + l.service.price_cents * l.qty, 0);
  const totalMins = cart.reduce((sum, l) => sum + l.service.duration_minutes * l.qty, 0);

  function handleContinue() {
    // Fire-and-forget: a single-service booking is a clean preference
    // signal; multi-service bookings don't map to one preferred service.
    if (user && salonId && cartCount === 1) {
      saveCustomerPreferences(salonId, { preferred_service_id: cart[0].service.id }).catch(() => {});
    }
    router.push({
      pathname: '/booking/staff',
      params: {
        salonId,
        salonSlug,
        salonName,
        requireOnlinePayment,
        serviceIds: cartServiceIds.join(','),
        serviceNames: cart.flatMap((l) => Array(l.qty).fill(l.service.name)).join('||'),
        totalCents: String(totalCents),
        totalMins: String(totalMins),
        ...(prefillStaffId ? { prefillStaffId } : {}),
        ...(prefillStartsAt ? { prefillStartsAt } : {}),
        ...(rebookSource ? { rebookSource } : {}),
      },
    });
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#F4D77A" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('booking:servicesScreen.title')}</Text>
          {salonName ? (
            <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <BreathingHeart size={40} color="#F4D77A" />
        </View>
      ) : loadError ? (
        <ErrorState message={t('booking:servicesScreen.loadErrorMessage')} onRetry={load} />
      ) : groups.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cut-outline" size={48} color="rgba(255,255,255,0.4)" />
          <Text style={styles.emptyTitle}>{t('booking:servicesScreen.emptyTitle')}</Text>
          <Text style={styles.emptySub}>{t('booking:servicesScreen.emptySubtitle')}</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {groups.map(({ category, items }) => (
            <View key={category} style={styles.categoryBlock}>
              <Text style={styles.categoryLabel}>{category}</Text>
              {items.map((svc) => {
                const qty = qtyOf(svc);
                const sel = qty > 0;
                return (
                  <Pressable
                    key={svc.id}
                    style={[styles.serviceCard, sel && styles.serviceCardSelected]}
                    onPress={() => addToCart(svc)}>
                    <CardOverlay />
                    {/* Selection indicator -- a qty stepper once at least one
                        unit is in the cart, so tapping again adds another
                        (same service twice) instead of deselecting. */}
                    {sel ? (
                      <View style={styles.qtyControls}>
                        <Pressable
                          style={styles.qtyBtn}
                          onPress={(e) => { e.stopPropagation(); removeFromCart(svc.id); }}>
                          <Ionicons name="remove" size={14} color="#F4D77A" />
                        </Pressable>
                        <Text style={styles.qtyText}>{qty}</Text>
                        <Pressable
                          style={styles.qtyBtn}
                          onPress={(e) => { e.stopPropagation(); addToCart(svc); }}>
                          <Ionicons name="add" size={14} color="#F4D77A" />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.checkbox} />
                    )}

                    {/* Info */}
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{svc.name}</Text>
                      {svc.description ? (
                        <Text style={styles.serviceDesc} numberOfLines={2}>
                          {svc.description}
                        </Text>
                      ) : null}
                      <View style={styles.serviceMeta}>
                        <View style={styles.metaChip}>
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
                          <Text style={styles.metaText}>{formatDuration(svc.duration_minutes)}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Price */}
                    <Text style={[styles.servicePrice, sel && styles.servicePriceSelected]}>
                      {formatPrice(svc.price_cents, svc.price_is_from)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Footer — shows when services selected */}
      {cartCount > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerCount}>
              {t('booking:servicesScreen.serviceCount', { count: cartCount })}
            </Text>
            <Text style={styles.footerMeta}>
              {formatDuration(totalMins)}
              {totalCents > 0 ? `  ·  ${formatPrice(totalCents)}` : ''}
            </Text>
          </View>
          <Pressable style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>{t('booking:servicesScreen.continueButton')}</Text>
            <Ionicons name="chevron-forward" size={18} color="#09000F" />
          </Pressable>
        </View>
      )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212,175,55,0.25)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  headerSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    marginTop: 2,
  },

  // List
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },
  categoryBlock: {
    marginBottom: Spacing.xl,
  },
  categoryLabel: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: 'rgba(212,175,55,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },

  // Service card
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    overflow: 'hidden',
  },
  serviceCardSelected: {
    borderColor: '#F4D77A',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: '#F4D77A',
    borderColor: '#F4D77A',
  },
  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  qtyBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  qtyText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.sm,
    color: '#F4D77A',
    minWidth: 14,
    textAlign: 'center',
  },
  serviceInfo: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  serviceDesc: {
    fontFamily: FontFamily.soraLight,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    lineHeight: FontSize.xs * 1.5,
  },
  serviceMeta: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },
  servicePrice: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    marginLeft: Spacing.md,
    flexShrink: 0,
  },
  servicePriceSelected: {
    color: '#F4D77A',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#09000F',
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  footerSummary: {
    flex: 1,
  },
  footerCount: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
  footerMeta: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    marginTop: 2,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F4D77A',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  continueBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
});
