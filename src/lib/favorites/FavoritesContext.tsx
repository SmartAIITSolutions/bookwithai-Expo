import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
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

// Single shared source of truth for favorited salons -- consumed by the tab
// bar (to decide whether Book stays visible), the salon screen (heart
// toggle), and the My Salons tab (list + Add Salon entry). Keeping this in
// one context means adding/removing a favorite from any of those places
// updates all the others immediately, no separate re-fetches to keep in sync.
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [salons, setSalons] = useState<FavoriteSalon[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setSalons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchFavoriteSalons();
      setSalons(data);
    } catch {
      // keep whatever was there before on a transient failure
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
