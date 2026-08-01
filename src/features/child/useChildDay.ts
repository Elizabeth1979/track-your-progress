import { useMemo } from 'react'
import {
  useChecklistCompletions,
  useChecklistItems,
  useCompletions,
  useRoutines,
  useTasks,
} from '@/lib/queries'
import { dayOfWeek, todayKey } from '@/lib/dates'
import type { ChecklistItem, Routine, Task, TaskCompletion, TimeSlot } from '@/types/db'

export type DayTask = {
  task: Task
  checklist: ChecklistItem[]
  completion: TaskCompletion | null
  done: boolean
  checkedItems: Set<string>
}

export type DaySlot = {
  slot: TimeSlot
  standalone: DayTask[]
  routines: { routine: Routine; tasks: DayTask[] }[]
}

export type ChildDay = {
  slots: DaySlot[]
  all: DayTask[]
  doneCount: number
  totalCount: number
  starsToday: number
  isPending: boolean
}

/** Assembles everything one child's screen needs for one date, from four cached queries. */
export function useChildDay(childId: string | undefined, forDate: string = todayKey()): ChildDay {
  const tasksQuery = useTasks()
  const itemsQuery = useChecklistItems()
  const completionsQuery = useCompletions(forDate)
  const checklistCompletionsQuery = useChecklistCompletions(forDate)
  const routinesQuery = useRoutines()

  const isPending =
    tasksQuery.isPending ||
    itemsQuery.isPending ||
    completionsQuery.isPending ||
    routinesQuery.isPending

  return useMemo(() => {
    const weekday = dayOfWeek(forDate)
    const tasks = (tasksQuery.data ?? []).filter(
      (task) => task.child_id === childId && task.is_active && task.days_of_week.includes(weekday),
    )
    const items = itemsQuery.data ?? []
    const completions = completionsQuery.data ?? []
    const checkedItemIds = new Set(
      (checklistCompletionsQuery.data ?? []).map((row) => row.item_id),
    )
    const routines = (routinesQuery.data ?? []).filter(
      (routine) => routine.child_id === childId && routine.is_active,
    )

    const dayTasks: DayTask[] = tasks.map((task) => {
      const completion = completions.find((row) => row.task_id === task.id) ?? null
      const checklist = items
        .filter((item) => item.task_id === task.id)
        .sort((a, b) => a.sort_order - b.sort_order)
      return {
        task,
        checklist,
        completion,
        done: completion !== null,
        checkedItems: new Set(checklist.filter((i) => checkedItemIds.has(i.id)).map((i) => i.id)),
      }
    })

    const slots: DaySlot[] = (['morning', 'afternoon', 'evening'] as TimeSlot[]).map((slot) => {
      const inSlot = dayTasks.filter((entry) => entry.task.time_slot === slot)
      const routinesInSlot = routines
        .filter((routine) => routine.time_slot === slot)
        .map((routine) => ({
          routine,
          tasks: inSlot.filter((entry) => entry.task.routine_id === routine.id),
        }))
        .filter((group) => group.tasks.length > 0)

      return {
        slot,
        standalone: inSlot.filter((entry) => !entry.task.routine_id),
        routines: routinesInSlot,
      }
    })

    const doneCount = dayTasks.filter((entry) => entry.done).length
    const starsToday = dayTasks
      .filter((entry) => entry.completion && entry.completion.status !== 'pending_approval')
      .reduce((sum, entry) => sum + (entry.completion?.stars_awarded ?? 0), 0)

    return {
      slots,
      all: dayTasks,
      doneCount,
      totalCount: dayTasks.length,
      starsToday,
      isPending,
    }
  }, [
    childId,
    forDate,
    tasksQuery.data,
    itemsQuery.data,
    completionsQuery.data,
    checklistCompletionsQuery.data,
    routinesQuery.data,
    isPending,
  ])
}
