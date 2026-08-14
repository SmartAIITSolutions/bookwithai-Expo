import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

// React Query's `refetchOnWindowFocus` is a web-only concept by default --
// on React Native there's no window to focus. Wiring AppState into
// `focusManager` is the documented RN equivalent: resuming the app from the
// background is treated the same as a browser tab regaining focus, so any
// query with `refetchOnWindowFocus` (the default) automatically refreshes
// stale data the moment the app comes back to the foreground, without a
// manual pull-to-refresh.
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active');
  }
}

AppState.addEventListener('change', onAppStateChange);

// Shared across the whole app -- one QueryClient instance, so the same
// query key (e.g. today's bookings) is cached and de-duplicated regardless
// of which screen requested it first.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data older than this is served instantly from cache while a fresh
      // fetch happens silently in the background -- this is what actually
      // fixes "page switch feels slow": the second and later visits to a
      // screen render immediately instead of showing a spinner every time.
      staleTime: 30_000,
      retry: 1,
    },
  },
});
