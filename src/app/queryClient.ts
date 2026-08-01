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

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: 24 * 60 * 60 * 1000,
  // Bump when cached shapes change, otherwise old clients rehydrate incompatible data.
  buster: 'v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
  },
}
