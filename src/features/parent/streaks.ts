import { dayOfWeek, todayKey } from '@/lib/dates'
import type { Task, TaskCompletion } from '@/types/db'

export type DayStat = {
  dateKey: string
  scheduled: number
  done: number
  ratio: number
}

/** How many tasks a child was actually assigned on a given date. */
export function scheduledCount(tasks: Task[], childId: string, dateKey: string): number {
  const weekday = dayOfWeek(dateKey)
  return tasks.filter(
    (task) => task.child_id === childId && task.is_active && task.days_of_week.includes(weekday),
  ).length
}

export function dayStats(
  tasks: Task[],
  completions: TaskCompletion[],
  childId: string,
  dateKeys: string[],
): DayStat[] {
  return dateKeys.map((dateKey) => {
    const scheduled = scheduledCount(tasks, childId, dateKey)
    const done = completions.filter(
      (row) => row.child_id === childId && row.for_date === dateKey,
    ).length
    return { dateKey, scheduled, done, ratio: scheduled === 0 ? 0 : Math.min(1, done / scheduled) }
  })
}

/**
 * Consecutive fully-completed days ending today. Days with nothing scheduled don't break
 * a streak — a child shouldn't lose it because a Saturday had no chores.
 */
export function currentStreak(stats: DayStat[], today: string = todayKey()): number {
  const ordered = [...stats].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1))
  let streak = 0

  for (const stat of ordered) {
    if (stat.dateKey > today) continue
    if (stat.scheduled === 0) continue
    if (stat.done >= stat.scheduled) streak += 1
    else break
  }

  return streak
}

export function completionRate(stats: DayStat[]): number {
  const scheduled = stats.reduce((sum, stat) => sum + stat.scheduled, 0)
  const done = stats.reduce((sum, stat) => sum + Math.min(stat.done, stat.scheduled), 0)
  return scheduled === 0 ? 0 : Math.round((done / scheduled) * 100)
}
