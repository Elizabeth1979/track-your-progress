import { Link, useOutletContext } from 'react-router-dom'
import { useToggleCompletion } from '@/lib/queries'
import { currentSlot, todayKey } from '@/lib/dates'
import { useT } from '@/i18n'
import { EmptyState, ProgressRing, Spinner, StarBadge } from '@/components/ui'
import { Avatar } from '@/components/AvatarPicker'
import { Celebration, useCelebration } from '@/components/Celebration'
import type { Child, TimeSlot } from '@/types/db'
import { useChildDay, type DayTask } from './useChildDay'
import './child.css'

const SLOT_ICON: Record<TimeSlot, string> = {
  morning: '🌅',
  afternoon: '🌤️',
  evening: '🌙',
}

export function TaskRow({
  entry,
  childId,
  onToggle,
}: {
  entry: DayTask
  childId: string
  onToggle: (entry: DayTask, done: boolean) => void
}) {
  const t = useT()
  const { task, done, completion, checklist, checkedItems } = entry
  const needsDetailScreen = task.type !== 'check'
  const pending = completion?.status === 'pending_approval'

  const meta =
    task.type === 'checklist'
      ? t.task.checklistProgress(checkedItems.size, checklist.length)
      : pending
        ? t.task.awaitingApproval
        : task.description || ''

  return (
    <li className={`task-row ${done ? 'is-done' : ''} ${pending ? 'is-pending' : ''}`}>
      <button
        type="button"
        className={`task-check ${done ? 'is-done' : ''}`}
        aria-pressed={done}
        aria-label={done ? t.task.undo : t.task.markDone}
        onClick={() => onToggle(entry, !done)}
      >
        ✓
      </button>

      <span className="task-row__icon" aria-hidden="true">
        {task.icon}
      </span>

      <span className="task-row__text">
        <span className="task-row__title">{task.title}</span>
        {meta && <span className="task-row__meta">{meta}</span>}
      </span>

      {task.stars_value > 0 && <StarBadge count={task.stars_value} />}

      {needsDetailScreen && (
        <Link
          className="task-open"
          to={`/child/${childId}/task/${task.id}`}
          aria-label={`${task.title} — ${t.common.continue}`}
        >
          ▸
        </Link>
      )}
    </li>
  )
}

export function MyDayPage() {
  const t = useT()
  const child = useOutletContext<Child>()
  const today = todayKey()
  const day = useChildDay(child.id, today)
  const toggle = useToggleCompletion(today)
  const [celebrating, celebrate] = useCelebration()
  const activeSlot = currentSlot()

  function onToggle(entry: DayTask, done: boolean) {
    toggle.mutate({ task: entry.task, done })
    if (done) celebrate()
  }

  if (day.isPending) {
    return (
      <main className="screen__body" id="main">
        <Spinner label={t.common.loading} />
      </main>
    )
  }

  const everythingDone = day.totalCount > 0 && day.doneCount === day.totalCount

  return (
    <>
      <Celebration show={celebrating} />

      <header className="day-header">
        <Avatar emoji={child.avatar_emoji} color={child.avatar_color} />
        <div className="day-header__text">
          <p className="day-header__greeting">{t.myDay.greeting(child.name)}</p>
          <p className="muted">{t.myDay.progressLabel(day.doneCount, day.totalCount)}</p>
          <StarBadge count={day.starsToday} />
        </div>
        <ProgressRing
          value={day.doneCount}
          total={day.totalCount}
          label={t.myDay.progressLabel(day.doneCount, day.totalCount)}
        />
      </header>

      <main className="screen__body" id="main">
        {day.totalCount === 0 && <EmptyState icon="🎈" title={t.myDay.noTasksToday} />}

        {everythingDone && (
          <div className="banner banner--success" role="status">
            {t.myDay.allDone}
          </div>
        )}

        {day.slots.map((slot) => {
          const hasContent = slot.standalone.length > 0 || slot.routines.length > 0
          if (!hasContent) return null

          return (
            <section
              key={slot.slot}
              className="slot-group"
              aria-label={t.myDay[
                slot.slot === 'morning'
                  ? 'slotMorning'
                  : slot.slot === 'afternoon'
                    ? 'slotAfternoon'
                    : 'slotEvening'
              ]}
            >
              <h2 className="slot-group__title">
                <span aria-hidden="true">{SLOT_ICON[slot.slot]}</span>
                {slot.slot === 'morning'
                  ? t.myDay.slotMorning
                  : slot.slot === 'afternoon'
                    ? t.myDay.slotAfternoon
                    : t.myDay.slotEvening}
                {slot.slot === activeSlot && <span className="muted">• {t.common.today}</span>}
              </h2>

              {slot.routines.map(({ routine, tasks }) => {
                const doneInRoutine = tasks.filter((entry) => entry.done).length
                return (
                  <Link
                    key={routine.id}
                    className="routine-card"
                    to={`/child/${child.id}/routine/${routine.id}`}
                  >
                    <span className="routine-card__icon" aria-hidden="true">
                      {routine.icon}
                    </span>
                    <span className="routine-card__text">
                      <span className="routine-card__name">{routine.name}</span>
                      <span className="routine-card__meta">
                        {t.myDay.routineOf(doneInRoutine, tasks.length)}
                      </span>
                    </span>
                    <span aria-hidden="true">▸</span>
                  </Link>
                )
              })}

              {slot.standalone.length > 0 && (
                <ul className="task-list">
                  {slot.standalone.map((entry) => (
                    <TaskRow
                      key={entry.task.id}
                      entry={entry}
                      childId={child.id}
                      onToggle={onToggle}
                    />
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </main>
    </>
  )
}
