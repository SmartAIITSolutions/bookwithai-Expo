import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

// Tab screens stay mounted when you switch away in React Navigation (no
// unmount/remount), so a query's own `useEffect` on mount only ever fires
// once per app session -- switching back to an already-visited tab showed
// stale data with no way to know it was stale. Pairs with a React Query
// `refetch` function to re-validate every time this screen actually
// regains focus, independent of the query's own staleTime.
export function useRefetchOnFocus(refetch: () => void) {
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
}
