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

/** Drops the cache when the signed-in user is not the one it was written for. */
export function ensureCacheOwner(userId: string | null) {
  const previous = window.localStorage.getItem(CACHE_OWNER_KEY)
  if (previous === userId) return

  if (previous !== null) purgePersistedCache()
  if (userId) window.localStorage.setItem(CACHE_OWNER_KEY, userId)
}

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  // Bump when cached shapes change, otherwise old clients rehydrate incompatible data.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  },
}
