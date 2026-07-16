import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchServicesBySalonId,
  groupServicesByCategory,
  formatPrice,
  formatDuration,
  type Service,
} from '@/lib/api/salon';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

export default function ServicesScreen() {
  const { salonId, salonSlug, salonName, requireOnlinePayment } = useLocalSearchParams<{
    salonId: string;
    salonSlug: string;
    salonName: string;
    requireOnlinePayment: string;
  }>();

  const [groups, setGroups] = useState<{ category: string; items: Service[] }[]>([]);
  const [selected, setSelected] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    fetchServicesBySalonId(salonId).then((svcs) => {
      // Filter out bundle-only and non-online-bookable
      const bookable = svcs.filter(
        (s) => !s.bundle_only && s.bookable_online !== false
      );
      setGroups(groupServicesByCategory(bookable));
      setLoading(false);
    });
  }, [salonId]);

  function toggleService(svc: Service) {
    setSelected((prev) =>
      prev.find((s) => s.id === svc.id)
        ? prev.filter((s) => s.id !== svc.id)
        : [...prev, svc]
    );
  }

  function isSelected(svc: Service) {
    return !!selected.find((s) => s.id === svc.id);
  }

  const totalCents = selected.reduce((sum, s) => sum + s.price_cents, 0);
  const totalMins = selected.reduce((sum, s) => sum + s.duration_minutes, 0);

  function handleContinue() {
    router.push({
      pathname: '/booking/staff',
      params: {
        salonId,
        salonSlug,
        salonName,
        requireOnlinePayment,
        serviceIds: selected.map((s) => s.id).join(','),
        serviceNames: selected.map((s) => s.name).join('||'),
        totalCents: String(totalCents),
        totalMins: String(totalMins),
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Select Services</Text>
          {salonName ? (
            <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cut-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No services available</Text>
          <Text style={styles.emptySub}>This salon has no online-bookable services yet.</Text>
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
                const sel = isSelected(svc);
                return (
                  <Pressable
                    key={svc.id}
                    style={[styles.serviceCard, sel && styles.serviceCardSelected]}
                    onPress={() => toggleService(svc)}>
                    {/* Selection indicator */}
                    <View style={[styles.checkbox, sel && styles.checkboxSelected]}>
                      {sel && <Ionicons name="checkmark" size={14} color={Colors.white} />}
                    </View>

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
                          <Ionicons name="time-outline" size={12} color={Colors.textSecondary} />
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
      {selected.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerSummary}>
            <Text style={styles.footerCount}>
              {selected.length} {selected.length === 1 ? 'service' : 'services'}
            </Text>
            <Text style={styles.footerMeta}>
              {formatDuration(totalMins)}
              {totalCents > 0 ? `  ·  ${formatPrice(totalCents)}` : ''}
            </Text>
          </View>
          <Pressable style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.white} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundMain,
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
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },

  // Service card
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.subtle,
  },
  serviceCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FAF8FF',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  serviceInfo: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  serviceDesc: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
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
    color: Colors.textSecondary,
  },
  servicePrice: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
    flexShrink: 0,
  },
  servicePriceSelected: {
    color: Colors.primary,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  footerMeta: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.button,
  },
  continueBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.white,
  },
});
