import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'kidtasks.query-cache',
})

/**
 * Which account the persisted cache belongs to. Query keys are not scoped per user,
 * so without this a second parent signing in on the same device — or the same parent
 * after joining a family — would rehydrate the previous snapshot from localStorage
 * instead of fetching. On a shared family device that is both a bug and a leak.
 */
const CACHE_OWNER_KEY = 'kidtasks.cache-owner'

export function purgePersistedCache() {
  queryClient.clear()
  window.localStorage.removeItem(CACHE_OWNER_KEY)
  void persister.removeClient()
}

/**
 * Drops the cache unless it was written for the user who is signed in now. An unmarked
 * cache predates this check, so it is treated as untrusted rather than adopted.
 */
export function ensureCacheOwner(userId: string | null) {
  const previous = window.localStorage.getItem(CACHE_OWNER_KEY)
  if (userId && previous === userId) return

  purgePersistedCache()
  if (userId) window.localStorage.setItem(CACHE_OWNER_KEY, userId)
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  // Bump when cached shapes change, otherwise old clients rehydrate incompatible data.
  // v2 discards caches written before the profile query was fixed; some of them hold a
  // null profile that would otherwise keep sending the user back to onboarding.
  buster: 'v2',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  },
}
