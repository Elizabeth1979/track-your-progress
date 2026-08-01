import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useRoutines, useToggleCompletion } from '@/lib/queries'
import { todayKey } from '@/lib/dates'
import { useT } from '@/i18n'
import { Button, Card, Spinner, StarBadge } from '@/components/ui'
import { Celebration, useCelebration } from '@/components/Celebration'
import { useChildDay } from './useChildDay'
import './task-detail.css'

/**
 * Walks a child through a routine one task at a time. Tasks that need their own screen
 * (checklist, timer, sport) hand off to the task detail route and come back completed.
 */
export function RoutinePlayPage() {
  const t = useT()
  const { childId, routineId } = useParams()
  const today = todayKey()
  const day = useChildDay(childId, today)
  const { data: routines, isPending: routinesPending } = useRoutines()
  const toggle = useToggleCompletion(today)
  const [celebrating, celebrate] = useCelebration()
  const [manualIndex, setManualIndex] = useState<number | null>(null)

  const routine = routines?.find((entry) => entry.id === routineId)
  const steps = useMemo(
    () => day.all.filter((entry) => entry.task.routine_id === routineId),
    [day.all, routineId],
  )

  const firstUnfinished = steps.findIndex((entry) => !entry.done)
  const index = manualIndex ?? (firstUnfinished === -1 ? steps.length : firstUnfinished)
  const current = steps[index]

  if (day.isPending || routinesPending) {
    return (
      <div className="center-screen">
        <Spinner label={t.common.loading} />
      </div>
    )
  }

  if (!routine || steps.length === 0) {
    return (
      <div className="center-screen stack">
        <p>{t.errors.notFound}</p>
        <Link to={`/child/${childId ?? ''}`}>{t.common.back}</Link>
      </div>
    )
  }

  const doneCount = steps.filter((entry) => entry.done).length
  const allDone = doneCount === steps.length

  function completeCurrent() {
    if (!current) return
    toggle.mutate({ task: current.task, done: true })
    celebrate()
    setManualIndex(null)
  }

  return (
    <div className="screen">
      <Celebration show={celebrating} />

      <header className="screen__header">
        <Link className="back-link" to={`/child/${childId}`} aria-label={t.common.back} />
        <h1>
          {routine.icon} {routine.name}
        </h1>
      </header>

      <main className="screen__body screen__body--narrow" id="main">
        <div className="routine-progress" aria-label={t.myDay.routineOf(doneCount, steps.length)}>
          {steps.map((entry, position) => (
            <span
              key={entry.task.id}
              className={entry.done ? 'is-done' : position === index ? 'is-current' : ''}
            />
          ))}
        </div>
        <p className="muted" style={{ textAlign: 'center' }}>
          {t.myDay.routineOf(doneCount, steps.length)}
        </p>

        {allDone || !current ? (
          <Card className="routine-step">
            <span className="routine-step__icon" aria-hidden="true">
              🎉
            </span>
            <h2>{t.routines.finished}</h2>
            <Link to={`/child/${childId}`}>
              <Button size="lg">{t.common.done}</Button>
            </Link>
          </Card>
        ) : (
          <>
            <Card className="routine-step">
              <span className="routine-step__icon" aria-hidden="true">
                {current.task.icon}
              </span>
              <h2>{current.task.title}</h2>
              {current.task.description && <p className="muted">{current.task.description}</p>}
              {current.task.stars_value > 0 && <StarBadge count={current.task.stars_value} />}
            </Card>

            {current.task.type === 'check' ? (
              <Button size="lg" fullWidth onClick={completeCurrent}>
                {t.task.finish}
              </Button>
            ) : (
              <Link to={`/child/${childId}/task/${current.task.id}`}>
                <Button size="lg" fullWidth>
                  {t.task.start}
                </Button>
              </Link>
            )}

            {index < steps.length - 1 && (
              <Button variant="ghost" fullWidth onClick={() => setManualIndex(index + 1)}>
                {t.common.skip}
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
