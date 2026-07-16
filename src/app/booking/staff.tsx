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
import { fetchStaffBySalonId, type StaffMember } from '@/lib/api/salon';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius, Shadows } from '@/constants/Theme';

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

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [anyAvailable, setAnyAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    fetchStaffBySalonId(salonId).then((data) => {
      setStaff(data);
      setLoading(false);
    });
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
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
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>

          {/* Any Available Option */}
          <Pressable
            style={[styles.card, anyAvailable && styles.cardSelected]}
            onPress={handleAnyAvailable}>
            <View style={[styles.avatarPlaceholder, anyAvailable && styles.avatarSelected]}>
              <Ionicons
                name="people-outline"
                size={26}
                color={anyAvailable ? Colors.white : Colors.textSecondary}
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
            <Ionicons name="chevron-forward" size={18} color={Colors.white} />
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundMain },
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
    borderBottomColor: Colors.border,
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
    color: Colors.textPrimary,
  },
  headerSub: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
    textAlign: 'center',
    marginVertical: Spacing.lg,
  },

  // Staff card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.md,
    ...Shadows.subtle,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FAF8FF',
  },

  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.backgroundLavender,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarSelected: {
    backgroundColor: Colors.primary,
  },
  avatarInitial: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  avatarInitialSelected: {
    color: Colors.white,
  },

  cardInfo: { flex: 1 },
  staffName: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  staffNameSelected: {
    color: Colors.primary,
  },
  staffRole: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  staffBio: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: FontSize.xs * 1.6,
    marginTop: 2,
  },

  // Radio
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
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
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
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
