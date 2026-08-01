import { beforeEach, describe, expect, it } from 'vitest'
import { ensureCacheOwner, purgePersistedCache, queryClient } from './queryClient'

const OWNER = 'kidtasks.cache-owner'

function seedCache(value: string) {
  queryClient.setQueryData(['children'], [{ id: 'c1', name: value }])
}

function cachedChildren() {
  return queryClient.getQueryData(['children'])
}

describe('ensureCacheOwner', () => {
  beforeEach(() => {
    localStorage.clear()
    queryClient.clear()
  })

  it('claims the cache for a first-time signed-in user', () => {
    ensureCacheOwner('user-a')
    expect(localStorage.getItem(OWNER)).toBe('user-a')
  })

  it('keeps the cache when the same user returns', () => {
    ensureCacheOwner('user-a')
    seedCache('Daniel')
    ensureCacheOwner('user-a')
    expect(cachedChildren()).toBeDefined()
    expect(localStorage.getItem(OWNER)).toBe('user-a')
  })

  it('drops another account cache when a second parent signs in', () => {
    ensureCacheOwner('user-a')
    seedCache('Daniel')

    ensureCacheOwner('user-b')

    // The first parent's children must not be visible to the second.
    expect(cachedChildren()).toBeUndefined()
    expect(localStorage.getItem(OWNER)).toBe('user-b')
  })

  it('drops the cache on sign-out so the next user starts clean', () => {
    ensureCacheOwner('user-a')
    seedCache('Daniel')

    ensureCacheOwner(null)

    expect(cachedChildren()).toBeUndefined()
    expect(localStorage.getItem(OWNER)).toBeNull()
  })

  it('purge clears both the query cache and the owner marker', () => {
    ensureCacheOwner('user-a')
    seedCache('Daniel')

    purgePersistedCache()

    expect(cachedChildren()).toBeUndefined()
    expect(localStorage.getItem(OWNER)).toBeNull()
  })
})
