import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, keepPreviousData } from '@tanstack/react-query';
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { DualBreathingBackground } from '@/components/DualBreathingBackground';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { OwnerScreenHeader } from '@/components/owner/OwnerScreenHeader';
import { BreathingHeart } from '@/components/BreathingHeart';
import { listCustomers, getMergeCandidates, CustomerLite } from '@/lib/api/ownerCustomers';
import { ErrorState } from '@/components/ErrorState';
import { useTranslation } from 'react-i18next';
import { formatCentsUSD } from '@/lib/i18n/format';
import { FontFamily, FontSize, Spacing, BorderRadius } from '@/constants/Theme';

function money(cents: number | null | undefined) { return formatCentsUSD(cents ?? 0); }

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
const SEARCH_DEBOUNCE_MS = 300;

function ownerCustomersQueryKey(q: string) {
  return ['owner-customers', q] as const;
}

export default function OwnerCustomersScreen() {
  const { t } = useTranslation(['owner']);
  const [query, setQuery] = useState('');

  // Search waits for a short pause in typing instead of firing a request
  // (and blanking the list) on every keystroke. Clearing the box applies
  // immediately so the full list comes straight back.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === '') { setDebouncedQuery(''); return; }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  // React Query instead of hand-rolled state: each search term is its own
  // cache entry (so a slow response for an older term can never overwrite
  // a newer one), the previous results stay on screen while a new term
  // loads (keepPreviousData) instead of a full-screen spinner, and the
  // unfiltered list is persisted to the device (queryPersistence.ts) so
  // the tab opens instantly on the next launch.
  const customersQuery = useInfiniteQuery({
    queryKey: ownerCustomersQueryKey(debouncedQuery),
    queryFn: async ({ pageParam }) => {
      const result = await listCustomers(debouncedQuery, pageParam, PAGE_SIZE);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.data.length, 0);
      return lastPage.data.length === PAGE_SIZE && loaded < lastPage.total ? allPages.length : undefined;
    },
    placeholderData: keepPreviousData,
  });
  const customers: CustomerLite[] = customersQuery.data?.pages.flatMap(p => p.data) ?? [];
  const loading = customersQuery.isPending;
  // Only an error with nothing to show replaces the list; a failed
  // background refresh keeps showing the list already on screen.
  const loadError = customersQuery.isError && !customersQuery.data ? customersQuery.error.message : null;
  const searching = customersQuery.isFetching && customersQuery.isPlaceholderData;

  const mergeQuery = useQuery({
    queryKey: ['owner-customer-merge-candidates'],
    queryFn: async () => {
      const r = await getMergeCandidates();
      if (!r.ok) throw new Error(r.error);
      return r.data.groups.length;
    },
  });
  const duplicateGroups = mergeQuery.data ?? 0;

  const loadMore = useCallback(() => {
    if (customersQuery.hasNextPage && !customersQuery.isFetchingNextPage && !customersQuery.isError) {
      customersQuery.fetchNextPage();
    }
  }, [customersQuery]);

  // Tabs stay mounted when you switch away, so re-validate silently every
  // time this tab regains focus (e.g. after adding/editing a customer
  // elsewhere) -- the list on screen stays put while it refreshes. The
  // very first focus is skipped: the queries above are already fetching.
  const hasFocusedOnce = useRef(false);
  const { refetch: refetchCustomers } = customersQuery;
  const { refetch: refetchMerge } = mergeQuery;
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) { hasFocusedOnce.current = true; return; }
      refetchCustomers();
      refetchMerge();
    }, [refetchCustomers, refetchMerge])
  );

  return (
    <View style={styles.container}>
      <DualBreathingBackground />
      <OwnerScreenHeader title={t('owner:customersScreen.title')} onNotificationsPress={() => router.push('/owner-notifications' as never)} />

      <BlurView intensity={90} tint="dark" style={styles.searchRow}>
        <CardOverlay />
        <Ionicons name="search" size={16} color="rgba(255,255,255,0.5)" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('owner:customersScreen.searchPlaceholder')}
          placeholderTextColor="rgba(255,255,255,0.4)"
          value={query}
          onChangeText={setQuery}
        />
        {searching && <BreathingHeart size={16} color="#F4D77A" />}
      </BlurView>

      {duplicateGroups > 0 && (
        <Pressable onPress={() => router.push('/customer/merge-duplicates' as never)}>
          <BlurView intensity={90} tint="dark" style={styles.duplicateBanner}>
            <CardOverlay />
            <Ionicons name="git-merge-outline" size={16} color="#F4D77A" />
            <Text style={styles.duplicateText}>{t('owner:customersScreen.duplicateGroups', { count: duplicateGroups })}</Text>
          </BlurView>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.centered}><BreathingHeart size={40} color="#F4D77A" /></View>
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={() => customersQuery.refetch()} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={customers}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Text style={styles.emptyHint}>{t('owner:customersScreen.emptyHint')}</Text>}
          ListFooterComponent={
            customersQuery.isFetchingNextPage ? (
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
                  <Text style={styles.rowMeta} numberOfLines={1}>{item.phone ?? item.email ?? t('owner:customersScreen.noContactInfo')}</Text>
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
