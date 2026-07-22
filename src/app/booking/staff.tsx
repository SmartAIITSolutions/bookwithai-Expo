import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingHeart } from '@/components/BreathingHeart';
import { fetchStaffBySalonId, type StaffMember } from '@/lib/api/salon';
import { saveCustomerPreferences } from '@/lib/api/customer';
import { useAuth } from '@/lib/auth/AuthContext';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';
import { ErrorState } from '@/components/ErrorState';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function StaffScreen() {
  const { salonId, salonSlug, salonName, requireOnlinePayment, serviceIds, serviceNames, totalCents, totalMins } =
    useLocalSearchParams<{
      salonId: string;
      salonSlug: string;
      salonName: string;
      requireOnlinePayment: string;
      serviceIds: string;
      serviceNames: string;
      totalCents: string;
      totalMins: string;
    }>();

  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [anyAvailable, setAnyAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  function load() {
    if (!salonId) return;
    setLoading(true);
    setLoadError(false);
    const ids = serviceIds ? serviceIds.split(',').filter(Boolean) : [];
    fetchStaffBySalonId(salonId, ids)
      .then((data) => setStaff(data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [salonId]);

  function handleSelectStaff(member: StaffMember) {
    setSelected(member);
    setAnyAvailable(false);
  }

  function handleAnyAvailable() {
    setAnyAvailable(true);
    setSelected(null);
  }

  function handleContinue() {
    // Fire-and-forget: a specific staff pick is a reasonable signal of
    // preference for this salon. Skipped for "Any Available" (no signal).
    if (user && salonId && selected) {
      saveCustomerPreferences(salonId, { preferred_staff_id: selected.id }).catch(() => {});
    }
    router.push({
      pathname: '/booking/datetime',
      params: {
        salonId,
        salonSlug,
        salonName,
        requireOnlinePayment,
        serviceIds,
        serviceNames,
        totalCents,
        totalMins,
        staffId: anyAvailable ? '' : (selected?.id ?? ''),
        staffName: anyAvailable ? 'Any Available' : (selected?.name ?? ''),
      },
    });
  }

  const canContinue = anyAvailable || selected !== null;

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
          <Text style={styles.headerTitle}>Choose Professional</Text>
          {salonName ? (
            <Text style={styles.headerSub} numberOfLines={1}>{salonName}</Text>
          ) : null}
        </View>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <BreathingHeart size={40} color="#F4D77A" />
        </View>
      ) : loadError ? (
        <ErrorState message="Unable to load staff. Please check your connection and try again." onRetry={load} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Any Available Option */}
          <Pressable
            style={[styles.card, anyAvailable && styles.cardSelected]}
            onPress={handleAnyAvailable}>
            <CardOverlay />
            <View style={[styles.avatarPlaceholder, anyAvailable && styles.avatarSelected]}>
              <Ionicons
                name="people-outline"
                size={26}
                color={anyAvailable ? '#09000F' : 'rgba(255,255,255,0.6)'}
              />
            </View>
            <View style={styles.cardInfo}>
              <Text style={[styles.staffName, anyAvailable && styles.staffNameSelected]}>
                Any Available Professional
              </Text>
              <Text style={styles.staffRole}>We'll match you with the best available</Text>
            </View>
            <View style={[styles.radio, anyAvailable && styles.radioSelected]}>
              {anyAvailable && <View style={styles.radioDot} />}
            </View>
          </Pressable>

          {staff.length > 0 && (
            <Text style={styles.orLabel}>— or choose someone specific —</Text>
          )}

          {staff.map((member) => {
            const sel = selected?.id === member.id;
            return (
              <Pressable
                key={member.id}
                style={[styles.card, sel && styles.cardSelected]}
                onPress={() => handleSelectStaff(member)}>
                <CardOverlay />
                {/* Avatar */}
                <View style={[styles.avatarPlaceholder, sel && styles.avatarSelected]}>
                  <Text style={[styles.avatarInitial, sel && styles.avatarInitialSelected]}>
                    {member.name.charAt(0).toUpperCase()}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={[styles.staffName, sel && styles.staffNameSelected]}>
                    {member.name}
                  </Text>
                  {member.role ? (
                    <Text style={styles.staffRole}>{member.role}</Text>
                  ) : null}
                  {member.bio ? (
                    <Text style={styles.staffBio} numberOfLines={2}>{member.bio}</Text>
                  ) : null}
                </View>

                {/* Radio */}
                <View style={[styles.radio, sel && styles.radioSelected]}>
                  {sel && <View style={styles.radioDot} />}
                </View>
              </Pressable>
            );
          })}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Footer */}
      {canContinue && (
        <View style={styles.footer}>
          <Pressable style={styles.continueBtn} onPress={handleContinue}>
            <Text style={styles.continueBtnText}>Select Date & Time</Text>
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
  container: { flex: 1, backgroundColor: 'transparent' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  headerCenter: { flex: 1, alignItems: 'center' },
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
  },

  orLabel: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginVertical: Spacing.lg,
  },

  // Staff card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    gap: Spacing.md,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: '#F4D77A',
    backgroundColor: 'rgba(212,175,55,0.1)',
  },

  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSelected: {
    backgroundColor: '#F4D77A',
  },
  avatarInitial: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: '#F4D77A',
  },
  avatarInitialSelected: {
    color: '#09000F',
  },

  cardInfo: { flex: 1 },
  staffName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  staffNameSelected: {
    color: '#F4D77A',
  },
  staffRole: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 3,
  },
  staffBio: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: FontSize.xs * 1.6,
    marginTop: 2,
  },

  // Radio
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: '#F4D77A',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F4D77A',
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
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#F4D77A',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  continueBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },
});
