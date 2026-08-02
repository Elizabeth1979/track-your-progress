import { beforeEach, describe, expect, it } from 'vitest'
import { pruneStaleTimers } from './timers'

const PREFIX = 'kidtasks.timer.'

describe('pruneStaleTimers', () => {
  beforeEach(() => localStorage.clear())

  it("keeps today's countdowns", () => {
    localStorage.setItem(`${PREFIX}task-abc-2026-08-02`, '{}')
    pruneStaleTimers('2026-08-02')
    expect(localStorage.getItem(`${PREFIX}task-abc-2026-08-02`)).toBe('{}')
  })

  it('drops a countdown left over from yesterday', () => {
    // The bug this guards: a daily task reopening in the "finished" state because
    // yesterday's expired end-time was still in storage.
    localStorage.setItem(`${PREFIX}task-abc-2026-08-01`, '{}')
    pruneStaleTimers('2026-08-02')
    expect(localStorage.getItem(`${PREFIX}task-abc-2026-08-01`)).toBeNull()
  })

  it('drops undated keys written by older versions', () => {
    localStorage.setItem(`${PREFIX}task-abc`, '{}')
    pruneStaleTimers('2026-08-02')
    expect(localStorage.getItem(`${PREFIX}task-abc`)).toBeNull()
  })

  it('drops stale sport legs but keeps todays', () => {
    localStorage.setItem(`${PREFIX}sport-x-0-work-2026-08-01`, '{}')
    localStorage.setItem(`${PREFIX}sport-x-0-work-2026-08-02`, '{}')
    pruneStaleTimers('2026-08-02')
    expect(localStorage.getItem(`${PREFIX}sport-x-0-work-2026-08-01`)).toBeNull()
    expect(localStorage.getItem(`${PREFIX}sport-x-0-work-2026-08-02`)).toBe('{}')
  })

  it('leaves unrelated storage alone', () => {
    localStorage.setItem('kidtasks.cache-owner', 'user-a')
    localStorage.setItem('kidtasks.query-cache', '{}')
    pruneStaleTimers('2026-08-02')
    expect(localStorage.getItem('kidtasks.cache-owner')).toBe('user-a')
    expect(localStorage.getItem('kidtasks.query-cache')).toBe('{}')
  })
})
