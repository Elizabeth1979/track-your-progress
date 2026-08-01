/**
 * Dates are stored as plain `YYYY-MM-DD` strings in the child's own local day,
 * never as UTC timestamps — "did you brush your teeth today" is a wall-clock question.
 */

export function toDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function todayKey(): string {
  return toDateKey()
}

/** JS `getDay()` convention: 0 = Sunday, which is also the first day of the Israeli week. */
export function dayOfWeek(key: string = todayKey()): number {
  return fromDateKey(key).getDay()
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** The seven date keys of the Sunday-to-Saturday week containing `key`. */
export function weekOf(key: string = todayKey()): string[] {
  const start = addDays(key, -dayOfWeek(key))
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

export function lastNDays(count: number, endKey: string = todayKey()): string[] {
  return Array.from({ length: count }, (_, index) => addDays(endKey, index - count + 1))
}

export function formatDate(key: string, locale: string): string {
  return fromDateKey(key).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatDateTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale === 'he' ? 'he-IL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** The slot a given wall-clock hour belongs to, used to pre-open the right section. */
export function currentSlot(now: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = now.getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}
