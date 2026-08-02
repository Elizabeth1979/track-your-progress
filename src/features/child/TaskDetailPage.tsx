import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useChildren, useToggleChecklistItem, useToggleCompletion } from '@/lib/queries'
import { formatDuration, todayKey } from '@/lib/dates'
import { notifyTimerDone, playChime, useCountdown, useWakeLock } from '@/lib/timers'
import { useT } from '@/i18n'
import { Button, Card, Spinner, StarBadge } from '@/components/ui'
import { Celebration, useCelebration } from '@/components/Celebration'
import { useChildDay, type DayTask } from './useChildDay'
import './task-detail.css'

function ChecklistView({ entry, onDone }: { entry: DayTask; onDone: () => void }) {
  const t = useT()
  const today = todayKey()
  const toggleItem = useToggleChecklistItem(today)
  const { checklist, checkedItems } = entry
  const allChecked = checklist.length > 0 && checkedItems.size === checklist.length

  return (
    <>
      <ul className="checklist">
        {checklist.map((item) => {
          const checked = checkedItems.has(item.id)
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`checklist__item ${checked ? 'is-done' : ''}`}
                aria-pressed={checked}
                onClick={() => toggleItem.mutate({ item, done: !checked })}
              >
                <span className={`task-check ${checked ? 'is-done' : ''}`} aria-hidden="true">
                  ✓
                </span>
                <span>{item.title}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <Button size="lg" fullWidth disabled={!allChecked || entry.done} onClick={onDone}>
        {entry.done ? t.task.approved : t.task.finish}
      </Button>
      {!allChecked && (
        <p className="muted" style={{ textAlign: 'center' }}>
          {t.task.checklistProgress(checkedItems.size, checklist.length)}
        </p>
      )}
    </>
  )
}

function TimerView({ entry, onDone }: { entry: DayTask; onDone: () => void }) {
  const t = useT()
  const duration = entry.task.timer_seconds ?? 60

  const handleFinish = useCallback(() => {
    playChime()
    notifyTimerDone(entry.task.title, t.task.timerDone)
  }, [entry.task.title, t.task.timerDone])

  // The date belongs in the key: without it a daily task reopens tomorrow holding
  // yesterday's expired countdown, so it renders as already finished and chimes on open.
  const timer = useCountdown(`task-${entry.task.id}-${todayKey()}`, duration, handleFinish)
  useWakeLock(timer.running)

  return (
    <>
      <div className={`timer ${timer.finished ? 'is-finished' : ''}`}>
        <span className="timer__value">{formatDuration(timer.remaining)}</span>
        {timer.finished && <span className="timer__done">{t.task.timerDone}</span>}
      </div>

      <div className="row" style={{ justifyContent: 'center' }}>
        {!timer.running && timer.remaining === duration && (
          <Button size="lg" onClick={timer.start}>
            {t.task.start}
          </Button>
        )}
        {timer.running && (
          <Button size="lg" variant="secondary" onClick={timer.pause}>
            {t.task.pause}
          </Button>
        )}
        {!timer.running && timer.remaining > 0 && timer.remaining < duration && (
          <Button size="lg" onClick={timer.resume}>
            {t.task.resume}
          </Button>
        )}
        {timer.remaining !== duration && (
          <Button variant="ghost" onClick={timer.reset}>
            {t.task.reset}
          </Button>
        )}
      </div>

      <Button
        size="lg"
        fullWidth
        variant={timer.finished ? 'primary' : 'secondary'}
        disabled={entry.done}
        onClick={onDone}
      >
        {entry.done ? t.task.approved : t.task.finish}
      </Button>
    </>
  )
}

const SETS_PREFIX = 'kidtasks.sets.'

/**
 * Which sets of a workout are ticked off, kept in localStorage under the day it belongs
 * to. A child who closes the app between sets should come back to their place, and the
 * date in the key means tomorrow starts clean.
 */
function useSetProgress(
  taskId: string,
  dateKey: string,
): [Set<number>, (next: Set<number>) => void] {
  const storageKey = `${SETS_PREFIX}${taskId}-${dateKey}`

  const [done, setDone] = useState<Set<number>>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      setDone(raw ? new Set(JSON.parse(raw) as number[]) : new Set())
    } catch {
      setDone(new Set())
    }
  }, [storageKey])

  const update = useCallback(
    (next: Set<number>) => {
      setDone(next)
      if (next.size === 0) localStorage.removeItem(storageKey)
      else localStorage.setItem(storageKey, JSON.stringify([...next]))
    },
    [storageKey],
  )

  return [done, update]
}

function SportView({ entry, onDone }: { entry: DayTask; onDone: () => void }) {
  const t = useT()
  const totalSets = entry.task.sets_count ?? 1
  const setSeconds = entry.task.set_seconds ?? 30
  const restSeconds = entry.task.rest_seconds ?? 0
  // A rep-based set has no countdown of its own — the child decides when it is done.
  // Rest between sets is still timed either way.
  const reps = entry.task.reps
  const isReps = reps != null

  // Which sets are ticked off. Kept per task and per day so a child who closes the app
  // mid-workout comes back to the same place rather than starting over.
  const [doneSets, setDoneSets] = useSetProgress(entry.task.id, todayKey())
  const [resting, setResting] = useState(false)

  const setIndex = Math.min(doneSets.size + 1, totalSets)
  const phase: 'work' | 'rest' = resting ? 'rest' : 'work'
  const duration = resting ? restSeconds : setSeconds
  const workoutComplete = doneSets.size >= totalSets

  const handleFinish = useCallback(() => {
    playChime()
    notifyTimerDone(
      entry.task.title,
      phase === 'work' ? t.task.restTime : t.task.nextSet,
    )
  }, [entry.task.title, phase, t.task.restTime, t.task.nextSet])

  // The key changes per set and phase, which resets the countdown for each leg. The
  // date is included for the same reason as the plain timer above.
  const timer = useCountdown(
    `sport-${entry.task.id}-${setIndex}-${phase}-${todayKey()}`,
    duration,
    handleFinish,
  )
  useWakeLock(timer.running)

  /** Ticking a set off starts the rest that follows it, unless it was the last one. */
  function completeSet(setNumber: number) {
    timer.reset()
    const next = new Set(doneSets)
    next.add(setNumber)
    setDoneSets(next)
    setResting(next.size < totalSets && restSeconds > 0)
  }

  function untickSet(setNumber: number) {
    timer.reset()
    const next = new Set(doneSets)
    next.delete(setNumber)
    setDoneSets(next)
    setResting(false)
  }

  function endRest() {
    timer.reset()
    setResting(false)
  }

  return (
    <>
      <p className="sport-phase">
        {workoutComplete
          ? t.task.sportDone
          : `${t.task.setOf(setIndex, totalSets)} • ${resting ? t.task.restTime : t.task.workTime}`}
      </p>

      {/*
        Every set is a row the child ticks off, rather than one button for the whole
        workout: it shows what is left, and lets them undo a mis-tap.
      */}
      <ul className="setlist">
        {Array.from({ length: totalSets }, (_, index) => index + 1).map((setNumber) => {
          const isDone = doneSets.has(setNumber)
          const isCurrent = !workoutComplete && setNumber === setIndex
          return (
            <li key={setNumber}>
              <button
                type="button"
                className={`setrow ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                onClick={() => (isDone ? untickSet(setNumber) : completeSet(setNumber))}
                aria-pressed={isDone}
              >
                <span className="setrow__num">{setNumber}</span>
                <span className="setrow__target">
                  {isReps ? `${reps} ${t.task.repsUnit}` : formatDuration(setSeconds)}
                </span>
                <span className="setrow__check" aria-hidden="true">
                  {isDone ? '✓' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {/* The rest countdown only appears between sets, where it is the thing to watch. */}
      {resting && (
        <div className={`timer is-rest ${timer.finished ? 'is-finished' : ''}`}>
          <span className="timer__value">{formatDuration(timer.remaining)}</span>
          <span className="timer__unit">{t.task.restTime}</span>
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center' }}>
        {resting && !timer.running && timer.remaining === duration && (
          <Button size="lg" onClick={timer.start}>
            {t.task.start}
          </Button>
        )}
        {resting && timer.running && (
          <Button size="lg" variant="secondary" onClick={timer.pause}>
            {t.task.pause}
          </Button>
        )}
        {resting && (
          <Button size="lg" variant={timer.finished ? 'primary' : 'ghost'} onClick={endRest}>
            {t.task.nextSet}
          </Button>
        )}
      </div>

      {workoutComplete && (
        <p className="banner banner--success" role="status">
          {t.task.sportDone}
        </p>
      )}

      <Button size="lg" fullWidth disabled={entry.done} onClick={onDone}>
        {entry.done ? t.task.approved : t.task.finish}
      </Button>
    </>
  )
}

export function TaskDetailPage() {
  const t = useT()
  const navigate = useNavigate()
  const { childId, taskId } = useParams()
  const today = todayKey()
  const day = useChildDay(childId, today)
  const { data: children } = useChildren()
  const toggle = useToggleCompletion(today)
  const [celebrating, celebrate] = useCelebration()

  const entry = useMemo(
    () => day.all.find((candidate) => candidate.task.id === taskId),
    [day.all, taskId],
  )
  const child = children?.find((candidate) => candidate.id === childId)

  if (day.isPending) {
    return (
      <div className="center-screen">
        <Spinner label={t.common.loading} />
      </div>
    )
  }

  if (!entry || !child) {
    return (
      <div className="center-screen stack">
        <p>{t.errors.notFound}</p>
        <Link to={`/child/${childId ?? ''}`}>{t.common.back}</Link>
      </div>
    )
  }

  function complete() {
    if (!entry) return
    toggle.mutate({ task: entry.task, done: true })
    celebrate()
    window.setTimeout(() => void navigate(`/child/${childId}`), 900)
  }

  return (
    <div className="screen">
      <Celebration show={celebrating} />

      <header className="screen__header">
        <Link className="back-link" to={`/child/${child.id}`} aria-label={t.common.back} />
        <h1>{entry.task.title}</h1>
        {entry.task.stars_value > 0 && <StarBadge count={entry.task.stars_value} />}
      </header>

      <main className="screen__body screen__body--narrow" id="main">
        <Card className="task-hero">
          <span className="task-hero__icon" aria-hidden="true">
            {entry.task.icon}
          </span>
          {entry.task.description && <p className="muted">{entry.task.description}</p>}
          {entry.completion?.status === 'pending_approval' && (
            <p className="banner banner--warn">{t.task.awaitingApproval}</p>
          )}
        </Card>

        {entry.task.type === 'checklist' && <ChecklistView entry={entry} onDone={complete} />}
        {entry.task.type === 'timer' && <TimerView entry={entry} onDone={complete} />}
        {entry.task.type === 'sport' && <SportView entry={entry} onDone={complete} />}
        {entry.task.type === 'check' && (
          <Button size="lg" fullWidth disabled={entry.done} onClick={complete}>
            {entry.done ? t.task.approved : t.task.finish}
          </Button>
        )}
      </main>
    </div>
  )
}
