import { describe, expect, it } from 'vitest'
import { completionRate, currentStreak, dayStats } from './streaks'
import type { Task, TaskCompletion } from '@/types/db'

const CHILD = 'child-1'

function task(id: string, days: number[]): Task {
  return {
    id,
    family_id: 'fam',
    child_id: CHILD,
    routine_id: null,
    title: id,
    description: null,
    icon: '✅',
    type: 'check',
    time_slot: 'morning',
    days_of_week: days,
    timer_seconds: null,
    sets_count: null,
    set_seconds: null,
    rest_seconds: null,
    stars_value: 1,
    requires_approval: false,
    is_active: true,
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function completion(taskId: string, forDate: string): TaskCompletion {
  return {
    id: `${taskId}-${forDate}`,
    family_id: 'fam',
    task_id: taskId,
    child_id: CHILD,
    for_date: forDate,
    status: 'done',
    stars_awarded: 1,
    client_id: 'c',
    completed_at: `${forDate}T08:00:00Z`,
    approved_at: null,
    approved_by: null,
  }
}

// 2026-08-01 is a Saturday, so this run covers a full Sun–Sat week.
const WEEK = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
]

describe('dayStats', () => {
  it('counts only the tasks scheduled for that weekday', () => {
    // Weekday-only task: Monday(1) to Friday(5).
    const tasks = [task('weekday', [1, 2, 3, 4, 5]), task('daily', [0, 1, 2, 3, 4, 5, 6])]
    const stats = dayStats(tasks, [], CHILD, ['2026-08-01', '2026-08-03'])

    expect(stats[0].scheduled).toBe(1) // Saturday: daily only
    expect(stats[1].scheduled).toBe(2) // Monday: both
  })

  it('ignores tasks belonging to another child', () => {
    const other = { ...task('t1', [0, 1, 2, 3, 4, 5, 6]), child_id: 'child-2' }
    expect(dayStats([other], [], CHILD, ['2026-08-01'])[0].scheduled).toBe(0)
  })
})

describe('currentStreak', () => {
  it('counts consecutive fully-completed days back from today', () => {
    const tasks = [task('t1', [0, 1, 2, 3, 4, 5, 6])]
    const completions = WEEK.map((date) => completion('t1', date))
    const stats = dayStats(tasks, completions, CHILD, WEEK)

    expect(currentStreak(stats, '2026-08-01')).toBe(6)
  })

  it('breaks the streak on a day that was left unfinished', () => {
    const tasks = [task('t1', [0, 1, 2, 3, 4, 5, 6])]
    const completions = WEEK.filter((date) => date !== '2026-07-30').map((d) => completion('t1', d))
    const stats = dayStats(tasks, completions, CHILD, WEEK)

    // Only 31 July and 1 Aug are complete before the gap on 30 July.
    expect(currentStreak(stats, '2026-08-01')).toBe(2)
  })

  it('does not break the streak on a day with nothing scheduled', () => {
    // Scheduled every day except Thursday (4): 2026-07-30 is a Thursday.
    const tasks = [task('t1', [0, 1, 2, 3, 5, 6])]
    const completions = WEEK.filter((date) => date !== '2026-07-30').map((d) => completion('t1', d))
    const stats = dayStats(tasks, completions, CHILD, WEEK)

    expect(currentStreak(stats, '2026-08-01')).toBe(5)
  })

  it('is zero when nothing has been completed', () => {
    const stats = dayStats([task('t1', [0, 1, 2, 3, 4, 5, 6])], [], CHILD, WEEK)
    expect(currentStreak(stats, '2026-08-01')).toBe(0)
  })
})

describe('completionRate', () => {
  it('is the share of scheduled tasks that were done', () => {
    const tasks = [task('t1', [0, 1, 2, 3, 4, 5, 6]), task('t2', [0, 1, 2, 3, 4, 5, 6])]
    const completions = [completion('t1', '2026-08-01'), completion('t1', '2026-07-31')]
    const stats = dayStats(tasks, completions, CHILD, ['2026-07-31', '2026-08-01'])

    expect(completionRate(stats)).toBe(50)
  })

  it('is zero rather than NaN when nothing was ever scheduled', () => {
    expect(completionRate([])).toBe(0)
  })
})
