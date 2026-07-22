import { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { BreathingHeart } from '@/components/BreathingHeart';
import { listCustomers, getMergeCandidates, CustomerLite } from '@/lib/api/ownerCustomers';
import { ErrorState } from '@/components/ErrorState';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function money(cents: number | null | undefined) { return `$${((cents ?? 0) / 100).toFixed(2)}`; }

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function CardOverlay() {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.035)', 'rgba(123,63,228,0.05)']}
      style={StyleSheet.absoluteFill}
    />
  );
}

const PAGE_SIZE = 50;

export default function OwnerCustomersScreen() {
  const [query, setQuery] = useState('');
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [duplicateGroups, setDuplicateGroups] = useState(0);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setLoadError(null);
    const result = await listCustomers(q, 0, PAGE_SIZE);
    if (result.ok) {
      setCustomers(result.data.data);
      setPage(0);
      setHasMore(result.data.data.length === PAGE_SIZE && result.data.data.length < result.data.total);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading || loadError) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const result = await listCustomers(query, nextPage, PAGE_SIZE);
    if (result.ok) {
      setCustomers((prev) => [...prev, ...result.data.data]);
      setPage(nextPage);
      setHasMore(
        result.data.data.length === PAGE_SIZE &&
        (nextPage + 1) * PAGE_SIZE < result.data.total
      );
    }
    setLoadingMore(false);
  }, [loadingMore, hasMore, loading, loadError, page, query]);

  useEffect(() => { load(query); }, [load, query]);
  useEffect(() => {
    getMergeCandidates().then(r => { if (r.ok) setDuplicateGroups(r.data.groups.length); });
  }, []);

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <OwnerScreenHeader title="Customers" onNotificationsPress={() => router.push('/owner-notifications' as never)} />

      <BlurView intensity={90} tint="dark" style={styles.searchRow}>
        <CardOverlay />
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, phone, or email"
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={query}
          onChangeText={setQuery}
        />
      </BlurView>

      {duplicateGroups > 0 && (
        <Pressable onPress={() => router.push('/customer/merge-duplicates' as never)}>
          <BlurView intensity={90} tint="dark" style={styles.duplicateBanner}>
            <CardOverlay />
            <Ionicons name="git-merge-outline" size={16} color="#F4D77A" />
            <Text style={styles.duplicateText}>{duplicateGroups} possible duplicate {duplicateGroups === 1 ? 'group' : 'groups'} — review</Text>
          </BlurView>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => load(query)} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={customers}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Text style={styles.emptyHint}>Your customer list starts here.</Text>}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}><BreathingHeart size={22} color="#F4D77A" /></View>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/customer/${item.id}` as never)}>
              <BlurView intensity={90} tint="dark" style={styles.row}>
                <CardOverlay />
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials(item.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>{item.phone ?? item.email ?? 'No contact info'}</Text>
                </View>
                <Text style={styles.rowSpend}>{money(item.total_spent_cents)}</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
              </BlurView>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#040108' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg,
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: Spacing.md, paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: '#FFFFFF' },

  duplicateBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginHorizontal: Spacing.lg,
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(212,175,55,0.08)', padding: Spacing.sm, marginBottom: Spacing.sm,
  },
  duplicateText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 110, gap: Spacing.sm },
  emptyHint: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: Spacing['2xl'] },
  footerLoading: { paddingVertical: Spacing.lg, alignItems: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212,175,55,0.5)',
    backgroundColor: 'rgba(0,0,0,0.2)', padding: Spacing.md,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
  rowName: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.base, color: '#FFFFFF' },
  rowMeta: { fontFamily: FontFamily.sora, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  rowSpend: { fontFamily: FontFamily.soraSemiBold, fontSize: FontSize.sm, color: '#F4D77A' },
});
