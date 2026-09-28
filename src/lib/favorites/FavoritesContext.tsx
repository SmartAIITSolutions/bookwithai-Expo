import { createContext, useCallback, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  fetchFavoriteSalons,
  addFavoriteSalon,
  removeFavoriteSalon,
  type FavoriteSalon,
} from '@/lib/api/favoriteSalons';

interface FavoritesContextValue {
  salons: FavoriteSalon[];
  loading: boolean;
  hasFavorites: boolean;
  refresh: () => Promise<void>;
  addFavorite: (clientId: string) => Promise<void>;
  removeFavorite: (clientId: string) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

// Stable empty list -- consumers use `salons` in effect/memo dependencies.
const NO_SALONS: FavoriteSalon[] = [];

export function favoriteSalonsQueryKey(userId: string | null) {
  return ['customer-favorite-salons', userId] as const;
}

// Single shared source of truth for favorited salons -- consumed by the tab
// bar (to decide whether Book stays visible), the salon screen (heart
// toggle), and the My Salons tab (list + Add Salon entry). Keeping this in
// one context means adding/removing a favorite from any of those places
// updates all the others immediately, no separate re-fetches to keep in sync.
//
// Backed by React Query so the list is persisted to the device
// (queryPersistence.ts, stamped with this user's id) and shows instantly on
// the next launch. Keyed on the user's id rather than depending on the
// `user` object, which is replaced on every token refresh -- that used to
// re-run the fetch (and flash My Salons' spinner) roughly hourly and on
// every app resume. `loading` is now only true for a genuinely first load;
// add/remove and refresh update the list in place.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const favoritesQuery = useQuery({
    queryKey: favoriteSalonsQueryKey(userId),
    queryFn: fetchFavoriteSalons,
    enabled: !!userId,
  });
  const salons = userId ? (favoritesQuery.data ?? NO_SALONS) : NO_SALONS;
  const loading = !!userId && favoritesQuery.isPending;

  const { refetch } = favoritesQuery;
  const refresh = useCallback(async () => {
    if (!userId) return;
    await refetch();
  }, [userId, refetch]);

  async function addFavorite(clientId: string) {
    await addFavoriteSalon(clientId);
    await refresh();
  }

  async function removeFavorite(clientId: string) {
    await removeFavoriteSalon(clientId);
    await refresh();
  }

  return (
    <FavoritesContext.Provider
      value={{ salons, loading, hasFavorites: salons.length > 0, refresh, addFavorite, removeFavorite }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites must be used within a FavoritesProvider');
  return ctx;
}
