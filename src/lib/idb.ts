/**
 * The few IndexedDB operations the outbox needs, wrapped in promises.
 *
 * This replaces Dexie, which cost 32 KB gzipped — more than React — to provide one
 * auto-incrementing table. The store layout below is deliberately the one Dexie already
 * created ('kidtasks', store 'outbox', inline auto-increment key 'seq', index on
 * 'createdAt'), so queues written by the previous version are still read and drained
 * rather than stranded.
 */

const DB_NAME = 'kidtasks'
const STORE = 'outbox'

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openAt(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = version == null ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'))
  })
}

let handle: Promise<IDBDatabase> | null = null

/**
 * Dexie numbered its schema versions in tens, so an existing install sits at IDB version
 * 10 rather than 1. Opening without a version avoids guessing: it yields whatever exists,
 * and only when the store is genuinely absent do we bump past the current version to
 * create it.
 */
function db(): Promise<IDBDatabase> {
  handle ??= (async () => {
    let database = await openAt()
    if (!database.objectStoreNames.contains(STORE)) {
      const next = database.version + 1
      database.close()
      database = await openAt(next)
    }
    // A tab that upgrades the schema elsewhere would otherwise leave this handle stale.
    database.onversionchange = () => {
      database.close()
      handle = null
    }
    return database
  })()
  return handle
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const database = await db()
  const transaction = database.transaction(STORE, mode)
  const result = await run(transaction.objectStore(STORE))
  // Resolve only once the transaction commits, so a caller that awaits a write and then
  // reads back cannot observe the state from before it landed.
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
  return result
}

/** Appends a record, assigning it the next sequence number. */
export async function idbAdd<T>(value: T): Promise<number> {
  return tx('readwrite', async (store) => (await promisify(store.add(value as object))) as number)
}

/** The lowest-numbered record still queued, or undefined when the queue is empty. */
export async function idbFirst<T>(): Promise<T | undefined> {
  return tx('readonly', async (store) => {
    const cursor = await promisify(store.openCursor())
    return cursor ? (cursor.value as T) : undefined
  })
}

export async function idbAll<T>(): Promise<T[]> {
  return tx('readonly', (store) => promisify(store.getAll() as IDBRequest<T[]>))
}

export async function idbDelete(key: number): Promise<void> {
  await tx('readwrite', (store) => promisify(store.delete(key)))
}

/** Merges `patch` into the stored record, leaving other fields untouched. */
export async function idbUpdate<T extends object>(key: number, patch: Partial<T>): Promise<void> {
  await tx('readwrite', async (store) => {
    const existing = (await promisify(store.get(key))) as T | undefined
    if (existing) await promisify(store.put({ ...existing, ...patch }))
  })
}

export async function idbCount(): Promise<number> {
  return tx('readonly', (store) => promisify(store.count()))
}

export async function idbClear(): Promise<void> {
  await tx('readwrite', (store) => promisify(store.clear()))
}
