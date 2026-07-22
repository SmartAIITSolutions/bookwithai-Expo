import {
  View, Text, StyleSheet, Pressable, Image,
  FlatList,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CalendarDays } from 'lucide-react-native';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { TabIcon, TAB_ICON_COLORS } from '@/components/TabIcon';
import { BreathingHeart } from '@/components/BreathingHeart';
import { InvisibleRefreshControl, RefreshHeartOverlay } from '@/components/PullToRefreshHeart';
import { useAuth } from '@/lib/auth/AuthContext';
import { useFavorites } from '@/lib/favorites/FavoritesContext';
import { type FavoriteSalon } from '@/lib/api/favoriteSalons';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function MySalonsScreen() {
  const { user, loading: authLoading } = useAuth();
  const { width, height } = useWindowDimensions();
  const { salons, loading, refresh } = useFavorites();
  const insets = useSafeAreaInsets();

  function handleAddSalon() {
    router.push('/(tabs)/book');
  }

  function handleOpenSalon(salon: FavoriteSalon) {
    router.push({ pathname: '/salon/[id]', params: { id: salon.slug } });
  }

  // Not signed in
  if (!authLoading && !user) {
    return (
      <View style={styles.screen}>
        <DualBreathingBackground />
        <SafeAreaView style={styles.container}>
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Canvas style={styles.emptyIconGlow} pointerEvents="none">
                <Circle cx={54} cy={54} r={54}>
                  <RadialGradient
                    c={vec(54, 54)}
                    r={54}
                    colors={['rgba(212,175,55,0.28)', 'rgba(123,63,228,0.05)', 'transparent']}
                  />
                </Circle>
                <Circle cx={54} cy={54} r={42} style="stroke" strokeWidth={2.5} color="#F4D77A">
                  <BlurMask blur={8} style="solid" />
                </Circle>
              </Canvas>
              <View style={styles.emptyIconRing}>
                <Ionicons name="heart-outline" size={32} color="#F4D77A" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>Your saved salons live here</Text>
            <View style={styles.emptyDivider} />
            <Text style={styles.emptySubtitle}>
              Sign in to save the salons you love for quick, one-tap booking.
            </Text>
            <Pressable style={styles.signInBtn} onPress={() => router.push('/auth')}>
              <Text style={styles.signInBtnText}>Sign In</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <DualBreathingBackground />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a salon"
        onPress={handleAddSalon}
        style={({ pressed }) => [styles.addSalonBtn, { top: insets.top + 8 }, pressed && { opacity: 0.7 }]}>
        <View style={styles.addSalonCircle}>
          <BlurView intensity={20} tint="dark" style={styles.addSalonCircleBlur}>
            <TabIcon Icon={CalendarDays} color={TAB_ICON_COLORS.gold} size={26} focused />
          </BlurView>
        </View>
        <Text style={styles.addSalonLabel}>Find Salon</Text>
      </Pressable>

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Salons</Text>
          <View style={[styles.sparkle, { top: 2, left: 118, width: 3, height: 3 }]} />
          <View style={[styles.sparkle, { top: 18, left: 138, width: 2, height: 2 }]} />
          <View style={[styles.sparkle, { top: 30, left: 100, width: 2, height: 2 }]} />
          <View style={[styles.sparkle, { top: 8, left: 155, width: 2.5, height: 2.5 }]} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <BreathingHeart />
          </View>
        ) : salons.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Canvas style={styles.emptyIconGlow} pointerEvents="none">
                <Circle cx={54} cy={54} r={54}>
                  <RadialGradient
                    c={vec(54, 54)}
                    r={54}
                    colors={['rgba(212,175,55,0.28)', 'rgba(123,63,228,0.05)', 'transparent']}
                  />
                </Circle>
                <Circle cx={54} cy={54} r={42} style="stroke" strokeWidth={2.5} color="#F4D77A">
                  <BlurMask blur={8} style="solid" />
                </Circle>
              </Canvas>
              <View style={styles.emptyIconRing}>
                <Ionicons name="heart-outline" size={32} color="#F4D77A" />
              </View>
            </View>
            <Text style={styles.emptyTitle}>No saved salons yet</Text>
            <View style={styles.emptyDivider} />
            <Text style={styles.emptySubtitle}>
              Tap the heart on a salon's page to save it here for next time.
            </Text>
            <Pressable style={styles.signInBtn} onPress={handleAddSalon}>
              <Text style={styles.signInBtnText}>Find a Salon</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
          <RefreshHeartOverlay refreshing={loading} />
          <FlatList
            style={{ flex: 1 }}
            data={salons}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={<InvisibleRefreshControl refreshing={loading} onRefresh={refresh} />}
            renderItem={({ item }) => (
              <Pressable onPress={() => handleOpenSalon(item)}>
                {({ pressed }) => (
                  <View style={[styles.card, pressed && { opacity: 0.85 }]}>
                    <CardOverlay />
                    {item.logo_url ? (
                      <Image source={{ uri: item.logo_url }} style={styles.logo} resizeMode="contain" />
                    ) : (
                      <View style={styles.logoPlaceholder}>
                        <Text style={styles.logoInitial}>
                          {item.business_name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.salonName} numberOfLines={1}>{item.business_name}</Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(212,175,55,0.6)" />
                  </View>
                )}
              </Pressable>
            )}
          />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#040108' },
  container: { flex: 1, backgroundColor: 'transparent' },

  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  title: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: FontSize['2xl'] + 6,
    color: '#FFFFFF',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  addSalonBtn: {
    position: 'absolute',
    right: 16 + 52 + 12,
    zIndex: 10,
    alignItems: 'center',
  },
  addSalonCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
  },
  addSalonCircleBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  addSalonLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 3,
    color: TAB_ICON_COLORS.gold,
  },
  sparkle: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#F4D77A',
    shadowColor: '#F4D77A',
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyIconGlow: { position: 'absolute', width: 108, height: 108 },
  emptyIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  emptyTitle: {
    fontFamily: 'PlayfairDisplay_600SemiBold',
    fontSize: FontSize.xl + 4,
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  emptyDivider: {
    width: 28,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.4)',
  },
  emptySubtitle: {
    fontFamily: FontFamily.sora,
    fontSize: FontSize.base,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
  },
  signInBtn: {
    marginTop: Spacing.md,
    backgroundColor: '#F4D77A',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  signInBtnText: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#09000F',
  },

  list: { padding: Spacing.xl, gap: Spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 24,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    overflow: 'hidden',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
  },
  logoInitial: {
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.lg,
    color: '#F4D77A',
  },
  salonName: {
    flex: 1,
    fontFamily: FontFamily.soraSemiBold,
    fontSize: FontSize.base,
    color: '#FFFFFF',
  },
});
