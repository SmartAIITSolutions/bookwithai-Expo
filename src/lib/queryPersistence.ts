import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client';
import type { Query } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

// Saves the owner Dashboard's React Query data to the device so a reopened
// app shows the last-known numbers instantly and refreshes them in the
// background, instead of a spinner on every cold open.
//
// Partition safety -- every persisted snapshot is stamped (`buster`) with
// the signed-in user's id. Restoring for any other user discards it
// outright, so one account's salon data can never hydrate into another
// account on the same device, even if a throttled save lands late after a
// sign-out. Only the owner-dashboard query roots below are ever written;
// nothing customer- or staff-facing is persisted.

const PERSISTED_QUERY_ROOTS = new Set([
  'owner-dashboard-summary',
  'owner-bookings',
  'owner-payment-status',
  'owner-business',
  'owner-staff',
  'owner-recent-activity',
  'owner-sanaa-status',
]);

const CACHE_VERSION = 'v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const THROTTLE_MS = 1000;

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'bwa_query_cache',
  throttleTime: THROTTLE_MS,
});

function busterFor(userId: string) {
  return `${CACHE_VERSION}:${userId}`;
}

function shouldPersistQuery(query: Query) {
  const root = query.queryKey[0];
  return query.state.status === 'success' && typeof root === 'string' && PERSISTED_QUERY_ROOTS.has(root);
}

let activeUserId: string | null = null;
// Whose snapshot was last hydrated into memory by restoreQueryCache() --
// tracked separately so a restore that lands after a sign-out's clear can
// still never carry over into a different user's session.
let hydratedUserId: string | null = null;
let unsubscribe: (() => void) | null = null;

// Hydrates the in-memory cache from disk for this user. Called on cold
// start before routing, so the first screen renders with data already
// present. Never throws -- a failed/foreign/expired snapshot just means
// screens fetch normally.
export async function restoreQueryCache(userId: string): Promise<void> {
  hydratedUserId = userId;
  try {
    await persistQueryClientRestore({
      queryClient,
      persister,
      maxAge: MAX_AGE_MS,
      buster: busterFor(userId),
    });
  } catch {
    // best-effort
  }
}

// Starts saving this user's allow-listed queries to disk. A different user
// becoming active first drops everything the previous user had in memory.
export function activateQueryPersistence(userId: string): void {
  if (activeUserId === userId) return;
  const previousUserId = activeUserId ?? hydratedUserId;
  unsubscribe?.();
  unsubscribe = null;
  if (previousUserId !== null && previousUserId !== userId) {
    queryClient.clear();
  }
  activeUserId = userId;
  hydratedUserId = userId;
  unsubscribe = persistQueryClientSubscribe({
    queryClient,
    persister,
    buster: busterFor(userId),
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  });
}

// Sign-out / no session: stop saving, drop all in-memory query data, and
// delete the on-disk snapshot. The delete is repeated after the throttle
// window so a save already queued before sign-out can't leave data behind.
export async function clearQueryPersistence(): Promise<void> {
  unsubscribe?.();
  unsubscribe = null;
  activeUserId = null;
  hydratedUserId = null;
  queryClient.clear();
  try {
    await persister.removeClient();
  } catch {
    // best-effort
  }
  setTimeout(() => {
    if (activeUserId === null) Promise.resolve(persister.removeClient()).catch(() => {});
  }, THROTTLE_MS + 250);
}
