import { useQuery } from '@tanstack/react-query';
import { fetchNotifications } from './api';

// Perf pass — NotificationBell.tsx (mounted separately on every one of the
// four customer tabs: book/my-salons/my-booking/account) and
// notifications.tsx each used to call fetchNotifications() directly in
// their own useFocusEffect, uncached -- switching between any two customer
// tabs re-fetched the same list twice over, and opening the notifications
// screen fetched it a third time. One shared query key means React Query
// dedupes concurrent requests and shares the cached result across every
// mounted bell instance and the full screen alike.
export const notificationsQueryKey = ['notifications'] as const;

export function useNotifications() {
  return useQuery({ queryKey: notificationsQueryKey, queryFn: fetchNotifications });
}
