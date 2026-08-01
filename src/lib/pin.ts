/**
 * The parent PIN is a UX gate, not a security boundary: child mode runs on the parent's
 * authenticated session, so RLS sees a parent either way. It exists to stop a child
 * wandering into the parent area, and the hash keeps the digits out of the database.
 */

const UNLOCK_KEY = 'kidtasks.parentUnlockedAt'
const UNLOCK_TTL_MS = 10 * 60 * 1000

export async function hashPin(pin: string, familyId: string): Promise<string> {
  const data = new TextEncoder().encode(`${pin}:${familyId}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPin(pin: string, familyId: string, hash: string): Promise<boolean> {
  return (await hashPin(pin, familyId)) === hash
}

export function markParentUnlocked(): void {
  sessionStorage.setItem(UNLOCK_KEY, String(Date.now()))
}

export function clearParentUnlock(): void {
  sessionStorage.removeItem(UNLOCK_KEY)
}

/** Unlock survives navigation but expires, so a forgotten open tab re-locks itself. */
export function isParentUnlocked(): boolean {
  const raw = sessionStorage.getItem(UNLOCK_KEY)
  if (!raw) return false
  const unlockedAt = Number(raw)
  if (!Number.isFinite(unlockedAt)) return false
  if (Date.now() - unlockedAt > UNLOCK_TTL_MS) {
    clearParentUnlock()
    return false
  }
  return true
}
