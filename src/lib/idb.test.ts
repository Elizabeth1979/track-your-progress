import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The outbox used to be a Dexie table. Dexie numbers its schema versions in tens, so a
 * phone that ran the previous release has 'kidtasks' open at IDB version 10 — not 1.
 * These tests pin the behaviour that matters on upgrade: work a child queued offline
 * before the update is still there afterwards, rather than silently dropped.
 */

const DB_NAME = 'kidtasks'
const STORE = 'outbox'

/** Recreates exactly what Dexie's `db.version(1).stores({ outbox: '++seq, createdAt' })` left behind. */
function createLegacyDexieDatabase(rows: object[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 10)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, {
        keyPath: 'seq',
        autoIncrement: true,
      })
      store.createIndex('createdAt', 'createdAt')
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(STORE, 'readwrite')
      for (const row of rows) tx.objectStore(STORE).add(row)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  })
}

function deleteDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

describe('IndexedDB outbox store', () => {
  beforeEach(async () => {
    await deleteDatabase()
    // The helper memoises its connection, so each test needs a fresh copy of the module.
    vi.resetModules()
  })

  it('reads a queue left behind by the Dexie version instead of starting empty', async () => {
    await createLegacyDexieDatabase([
      { op: { kind: 'completion.add', taskId: 't1' }, createdAt: 1, attempts: 0 },
      { op: { kind: 'completion.add', taskId: 't2' }, createdAt: 2, attempts: 0 },
    ])

    const { idbAll, idbCount } = await import('./idb')

    expect(await idbCount()).toBe(2)
    const rows = await idbAll<{ seq: number; op: { taskId: string } }>()
    expect(rows.map((row) => row.op.taskId)).toEqual(['t1', 't2'])
  })

  it('keeps assigning sequence numbers after the ones Dexie already used', async () => {
    await createLegacyDexieDatabase([{ op: { kind: 'a' }, createdAt: 1, attempts: 0 }])

    const { idbAdd, idbFirst } = await import('./idb')
    const seq = await idbAdd({ op: { kind: 'b' }, createdAt: 2, attempts: 0 })

    // A restarted counter would collide with the existing row and lose it.
    expect(seq).toBe(2)
    const first = await idbFirst<{ op: { kind: string } }>()
    expect(first?.op.kind).toBe('a')
  })

  it('creates the store from scratch on a first install', async () => {
    const { idbAdd, idbCount } = await import('./idb')

    await idbAdd({ op: { kind: 'a' }, createdAt: 1, attempts: 0 })
    expect(await idbCount()).toBe(1)
  })

  it('drains in insertion order and updates in place', async () => {
    const { idbAdd, idbFirst, idbUpdate, idbDelete, idbCount, idbClear } = await import('./idb')

    await idbAdd({ op: { kind: 'first' }, createdAt: 1, attempts: 0 })
    const second = await idbAdd({ op: { kind: 'second' }, createdAt: 2, attempts: 0 })

    const head = await idbFirst<{ seq: number; op: { kind: string } }>()
    expect(head?.op.kind).toBe('first')

    await idbUpdate<{ attempts: number; op: { kind: string } }>(second, { attempts: 3 })
    const rows = await idbAll2()
    expect(rows.find((row) => row.seq === second)?.attempts).toBe(3)
    // Patching must not clobber the fields it did not mention.
    expect(rows.find((row) => row.seq === second)?.op.kind).toBe('second')

    await idbDelete(head!.seq)
    expect(await idbCount()).toBe(1)

    await idbClear()
    expect(await idbCount()).toBe(0)

    async function idbAll2() {
      const { idbAll } = await import('./idb')
      return idbAll<{ seq: number; attempts: number; op: { kind: string } }>()
    }
  })
})
