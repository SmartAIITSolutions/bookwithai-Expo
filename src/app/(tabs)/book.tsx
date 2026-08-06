import { QRScanner } from '@/components/scanner/QRScanner';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { QrCode, Link2, List, Map as MapIcon, Heart, MapPin } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout } from 'react-native-maps';
import { fetchSalonDirectory, type SalonListing } from '@/lib/api/salon';
import { useFavorites } from '@/lib/favorites/FavoritesContext';

const COLORS = {
  backgroundBottom: '#040108',
  purpleSoft: '#C7A8FF',
  goldLight: '#F4D77A',
  white: '#FFFFFF',
  body: 'rgba(255,255,255,0.74)',
  muted: 'rgba(255,255,255,0.52)',
};

const INTER = 'Inter_400Regular';
const INTER_SEMI = 'Inter_600SemiBold';
const INTER_BOLD = 'Inter_700Bold';

type ViewMode = 'list' | 'map';

export default function BookScreen() {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [slug, setSlug] = useState('');
  const [query, setQuery] = useState('');
  const [salons, setSalons] = useState<SalonListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<ViewMode>('list');
  const { salons: favorites, addFavorite, removeFavorite } = useFavorites();
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const data = await fetchSalonDirectory(q);
      setSalons(data);
    } catch {
      // keep whatever list was already showing on a transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => load(query), 300);
    return () => clearTimeout(timeout);
  }, [query, load]);

  const mappable = salons.filter((s) => s.latitude != null && s.longitude != null);

  function openSalon(s: SalonListing) {
    router.push({ pathname: '/salon/[id]', params: { id: s.slug } });
  }

  function toggleFavorite(s: SalonListing) {
    if (favoriteIds.has(s.id)) removeFavorite(s.id);
    else addFavorite(s.id);
  }

  function handleGoToSalon() {
    const trimmed = slug.trim();
    if (!trimmed) return;

    const normalized = trimmed
      .replace(/^https?:\/\/(www\.)?bookwithai\.app\/book\//i, '')
      .replace(/^\/+|\/+$/g, '');

    if (!normalized) return;

    setLinkModalOpen(false);
    setSlug('');
    router.push({ pathname: '/salon/[id]', params: { id: normalized } });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.backgroundBottom} />

      <View style={styles.screen}>
        <DualBreathingBackground />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Discover</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open QR code scanner"
              onPress={() => setScannerOpen(true)}
              style={styles.headerIconButton}>
              <QrCode size={17} color={COLORS.goldLight} strokeWidth={1.6} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter a salon link"
              onPress={() => setLinkModalOpen(true)}
              style={styles.headerIconButton}>
              <Link2 size={17} color={COLORS.goldLight} strokeWidth={1.6} />
            </Pressable>
          </View>
        </View>

        <View style={styles.searchRow}>
          <BlurView intensity={90} tint="dark" style={styles.searchCard}>
            <LinearGradient
              colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
              style={StyleSheet.absoluteFill}
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search salons or cities"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={COLORS.goldLight}
              style={styles.searchInput}
            />
          </BlurView>

          <View style={styles.modeToggle}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="List view"
              onPress={() => setMode('list')}
              style={[styles.modeButton, mode === 'list' && styles.modeButtonActive]}>
              <List size={16} color={mode === 'list' ? '#0A0410' : COLORS.body} strokeWidth={1.8} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Map view"
              onPress={() => setMode('map')}
              style={[styles.modeButton, mode === 'map' && styles.modeButtonActive]}>
              <MapIcon size={16} color={mode === 'map' ? '#0A0410' : COLORS.body} strokeWidth={1.8} />
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={COLORS.goldLight} />
          </View>
        ) : mode === 'list' ? (
          <FlatList
            data={salons}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {query ? 'No salons match your search.' : 'No salons are listed yet.'}
              </Text>
            }
            renderItem={({ item }) => (
              <SalonCard
                salon={item}
                favorited={favoriteIds.has(item.id)}
                onPress={() => openSalon(item)}
                onToggleFavorite={() => toggleFavorite(item)}
              />
            )}
          />
        ) : (
          <View style={styles.mapWrap}>
            {mappable.length === 0 ? (
              <View style={styles.centerFill}>
                <Text style={styles.emptyText}>No salons with a mapped location yet.</Text>
              </View>
            ) : (
              // Android needs a Google Maps API key (app.json ->
              // android.config.googleMaps.apiKey) or tiles render blank in
              // production builds -- not yet configured. iOS uses Apple Maps
              // and needs no key.
              <MapView
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: mappable[0].latitude!,
                  longitude: mappable[0].longitude!,
                  latitudeDelta: 8,
                  longitudeDelta: 8,
                }}>
                {mappable.map((s) => (
                  <Marker key={s.id} coordinate={{ latitude: s.latitude!, longitude: s.longitude! }}>
                    <View style={styles.pin}>
                      <MapPin size={22} color={COLORS.goldLight} fill="rgba(212,175,55,0.25)" strokeWidth={1.8} />
                    </View>
                    <Callout onPress={() => openSalon(s)} tooltip={false}>
                      <View style={styles.calloutBox}>
                        <Text style={styles.calloutTitle}>{s.business_name}</Text>
                        {!!(s.city || s.state) && (
                          <Text style={styles.calloutSubtitle}>{[s.city, s.state].filter(Boolean).join(', ')}</Text>
                        )}
                        <Text style={styles.calloutLink}>View salon</Text>
                      </View>
                    </Callout>
                  </Marker>
                ))}
              </MapView>
            )}
          </View>
        )}
      </View>

      <Modal
        visible={scannerOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setScannerOpen(false)}>
        <QRScanner onClose={() => setScannerOpen(false)} />
      </Modal>

      <Modal
        visible={linkModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setLinkModalOpen(false)}>
        <Pressable style={styles.linkModalBackdrop} onPress={() => setLinkModalOpen(false)}>
          <Pressable style={styles.linkModalCard} onPress={(e) => e.stopPropagation()}>
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
            <Text style={styles.inputLabel}>Salon booking link</Text>
            <Text style={styles.inputHelper}>Enter the salon name from its Book With AI URL.</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={slug}
                onChangeText={setSlug}
                onSubmitEditing={handleGoToSalon}
                placeholder="brows-by-tina"
                placeholderTextColor="rgba(255,255,255,0.3)"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="go"
                autoFocus
                selectionColor={COLORS.goldLight}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open salon booking page"
                onPress={handleGoToSalon}
                disabled={!slug.trim()}
                style={({ pressed }) => [
                  styles.goWrapper,
                  pressed && styles.pressed,
                  !slug.trim() && styles.disabled,
                ]}>
                <LinearGradient
                  colors={['#9B5CFF', '#5B2EFF']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.goButton}>
                  <Text style={styles.goText}>Go</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SalonCard({
  salon,
  favorited,
  onPress,
  onToggleFavorite,
}: {
  salon: SalonListing;
  favorited: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
      {salon.logo_url ? (
        <Image source={{ uri: salon.logo_url }} style={styles.cardLogo} resizeMode="cover" />
      ) : (
        <View style={[styles.cardLogo, styles.cardLogoFallback]}>
          <Text style={styles.cardLogoInitial}>{salon.business_name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{salon.business_name}</Text>
        {!!(salon.city || salon.state) && (
          <Text style={styles.cardLocation}>{[salon.city, salon.state].filter(Boolean).join(', ')}</Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorited ? 'Remove favorite' : 'Add favorite'}
        onPress={onToggleFavorite}
        hitSlop={10}
        style={styles.heartButton}>
        <Heart
          size={18}
          color={favorited ? COLORS.goldLight : 'rgba(255,255,255,0.4)'}
          fill={favorited ? COLORS.goldLight : 'transparent'}
          strokeWidth={1.8}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.backgroundBottom },

  screen: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 4,
  },

  headerTitle: {
    color: COLORS.white,
    fontFamily: INTER_BOLD,
    fontSize: 22,
  },

  headerActions: { flexDirection: 'row', gap: 10 },

  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  searchCard: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    justifyContent: 'center',
  },

  searchInput: {
    height: '100%',
    paddingHorizontal: 14,
    color: COLORS.white,
    fontFamily: INTER,
    fontSize: 14,
  },

  modeToggle: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
  },

  modeButton: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },

  modeButtonActive: { backgroundColor: COLORS.goldLight },

  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 30,
    color: COLORS.muted,
    fontFamily: INTER,
    fontSize: 13,
  },

  listContent: { paddingHorizontal: 20, paddingBottom: 100, gap: 10 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },

  cardPressed: { opacity: 0.82 },

  cardLogo: { width: 44, height: 44, borderRadius: 12 },

  cardLogoFallback: {
    backgroundColor: 'rgba(155,92,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardLogoInitial: { color: COLORS.purpleSoft, fontFamily: INTER_BOLD, fontSize: 17 },

  cardInfo: { flex: 1 },

  cardName: { color: COLORS.white, fontFamily: INTER_SEMI, fontSize: 14.5 },

  cardLocation: { color: COLORS.muted, fontFamily: INTER, fontSize: 12, marginTop: 2 },

  heartButton: { padding: 6 },

  mapWrap: { flex: 1, marginTop: 4 },

  pin: { alignItems: 'center', justifyContent: 'center' },

  calloutBox: { minWidth: 160, padding: 4 },

  calloutTitle: { fontFamily: INTER_SEMI, fontSize: 13, color: '#1A1420' },

  calloutSubtitle: { fontFamily: INTER, fontSize: 11.5, color: '#5A5560', marginTop: 2 },

  calloutLink: { fontFamily: INTER_SEMI, fontSize: 12, color: '#5B2EFF', marginTop: 6 },

  linkModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  linkModalCard: {
    width: '100%',
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(10,4,16,0.6)',
  },

  inputLabel: { color: COLORS.white, fontFamily: INTER_BOLD, fontSize: 13 },

  inputHelper: {
    marginTop: 5,
    marginBottom: 13,
    color: COLORS.muted,
    fontFamily: INTER,
    fontSize: 11.5,
    lineHeight: 17,
  },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  input: {
    flex: 1,
    height: 54,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
    backgroundColor: 'rgba(5,1,10,0.5)',
    paddingHorizontal: 16,
    color: COLORS.white,
    fontFamily: INTER,
    fontSize: 14,
  },

  goWrapper: { width: 72, height: 54, borderRadius: 15, overflow: 'hidden' },

  goButton: {
    flex: 1,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(244,215,122,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  goText: { color: COLORS.white, fontFamily: INTER_BOLD, fontSize: 15 },

  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },

  disabled: { opacity: 0.42 },
});
