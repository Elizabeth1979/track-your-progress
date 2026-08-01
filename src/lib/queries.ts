import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { enqueue } from './outbox'
import { todayKey } from './dates'
import type {
  Child,
  ChecklistItem,
  ChecklistItemCompletion,
  Family,
  Invite,
  JournalEntry,
  Reward,
  RewardRedemption,
  Routine,
  StarBalance,
  Task,
  TaskCompletion,
} from '@/types/db'

export const keys = {
  family: ['family'] as const,
  children: ['children'] as const,
  routines: ['routines'] as const,
  tasks: ['tasks'] as const,
  checklistItems: ['checklist-items'] as const,
  completions: (forDate: string) => ['completions', forDate] as const,
  completionsRange: (from: string, to: string) => ['completions-range', from, to] as const,
  checklistCompletions: (forDate: string) => ['checklist-completions', forDate] as const,
  pendingApprovals: ['pending-approvals'] as const,
  rewards: ['rewards'] as const,
  redemptions: ['redemptions'] as const,
  balances: ['star-balances'] as const,
  journal: (childId: string) => ['journal', childId] as const,
  invites: ['invites'] as const,
}

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error
  return (data ?? []) as T
}

export function useFamily() {
  return useQuery({
    queryKey: keys.family,
    queryFn: async (): Promise<Family | null> => {
      const { data, error } = await supabase.from('families').select('*').maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useChildren() {
  return useQuery({
    queryKey: keys.children,
    queryFn: async (): Promise<Child[]> =>
      unwrap(await supabase.from('children').select('*').order('sort_order').order('created_at')),
  })
}

export function useRoutines() {
  return useQuery({
    queryKey: keys.routines,
    queryFn: async (): Promise<Routine[]> =>
      unwrap(await supabase.from('routines').select('*').order('sort_order')),
  })
}

export function useTasks() {
  return useQuery({
    queryKey: keys.tasks,
    queryFn: async (): Promise<Task[]> =>
      unwrap(await supabase.from('tasks').select('*').order('sort_order').order('created_at')),
  })
}

export function useChecklistItems() {
  return useQuery({
    queryKey: keys.checklistItems,
    queryFn: async (): Promise<ChecklistItem[]> =>
      unwrap(await supabase.from('task_checklist_items').select('*').order('sort_order')),
  })
}

export function useCompletions(forDate: string = todayKey()) {
  return useQuery({
    queryKey: keys.completions(forDate),
    queryFn: async (): Promise<TaskCompletion[]> =>
      unwrap(await supabase.from('task_completions').select('*').eq('for_date', forDate)),
  })
}

export function useCompletionsRange(from: string, to: string) {
  return useQuery({
    queryKey: keys.completionsRange(from, to),
    queryFn: async (): Promise<TaskCompletion[]> =>
      unwrap(
        await supabase
          .from('task_completions')
          .select('*')
          .gte('for_date', from)
          .lte('for_date', to),
      ),
  })
}

export function useChecklistCompletions(forDate: string = todayKey()) {
  return useQuery({
    queryKey: keys.checklistCompletions(forDate),
    queryFn: async (): Promise<ChecklistItemCompletion[]> =>
      unwrap(
        await supabase.from('checklist_item_completions').select('*').eq('for_date', forDate),
      ),
  })
}

export function useStarBalances() {
  return useQuery({
    queryKey: keys.balances,
    queryFn: async (): Promise<StarBalance[]> =>
      unwrap(await supabase.from('child_star_balances').select('*')),
  })
}

export function useRewards() {
  return useQuery({
    queryKey: keys.rewards,
    queryFn: async (): Promise<Reward[]> =>
      unwrap(await supabase.from('rewards').select('*').order('sort_order').order('star_cost')),
  })
}

export function useRedemptions() {
  return useQuery({
    queryKey: keys.redemptions,
    queryFn: async (): Promise<RewardRedemption[]> =>
      unwrap(
        await supabase
          .from('reward_redemptions')
          .select('*')
          .order('requested_at', { ascending: false })
          .limit(100),
      ),
  })
}

export function useJournal(childId: string | null) {
  return useQuery({
    queryKey: keys.journal(childId ?? 'none'),
    enabled: Boolean(childId),
    queryFn: async (): Promise<JournalEntry[]> =>
      unwrap(
        await supabase
          .from('journal_entries')
          .select('*')
          .eq('child_id', childId!)
          .order('for_date', { ascending: false })
          .limit(60),
      ),
  })
}

export function useInvites() {
  return useQuery({
    queryKey: keys.invites,
    queryFn: async (): Promise<Invite[]> =>
      unwrap(
        await supabase
          .from('invites')
          .select('*')
          .is('used_at', null)
          .is('revoked_at', null)
          .order('created_at', { ascending: false }),
      ),
  })
}

/** Everything the "today" screens touch, invalidated together after a write. */
function invalidateToday(queryClient: QueryClient, forDate: string) {
  void queryClient.invalidateQueries({ queryKey: keys.completions(forDate) })
  void queryClient.invalidateQueries({ queryKey: keys.checklistCompletions(forDate) })
  void queryClient.invalidateQueries({ queryKey: keys.balances })
  void queryClient.invalidateQueries({ queryKey: ['completions-range'] })
}

/**
 * Toggling a task writes optimistically to the cache and queues the real write, so a
 * child tapping through their morning offline sees instant, durable feedback.
 */
export function useToggleCompletion(forDate: string = todayKey()) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      task,
      done,
    }: {
      task: Pick<Task, 'id' | 'child_id' | 'family_id' | 'stars_value' | 'requires_approval'>
      done: boolean
    }) => {
      if (done) {
        await enqueue({
          kind: 'completion.add',
          taskId: task.id,
          forDate,
          clientId: crypto.randomUUID(),
        })
      } else {
        await enqueue({ kind: 'completion.remove', taskId: task.id, forDate })
      }
    },
    onMutate: async ({ task, done }) => {
      const key = keys.completions(forDate)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<TaskCompletion[]>(key) ?? []

      queryClient.setQueryData<TaskCompletion[]>(key, (current = []) => {
        const withoutTask = current.filter((row) => row.task_id !== task.id)
        if (!done) return withoutTask

        const optimistic: TaskCompletion = {
          id: `optimistic-${task.id}`,
          family_id: task.family_id,
          task_id: task.id,
          child_id: task.child_id,
          for_date: forDate,
          status: task.requires_approval ? 'pending_approval' : 'done',
          stars_awarded: task.stars_value,
          client_id: crypto.randomUUID(),
          completed_at: new Date().toISOString(),
          approved_at: null,
          approved_by: null,
        }
        return [...withoutTask, optimistic]
      })

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(keys.completions(forDate), context.previous)
    },
    onSettled: () => invalidateToday(queryClient, forDate),
  })
}

export function useToggleChecklistItem(forDate: string = todayKey()) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ item, done }: { item: ChecklistItem; done: boolean }) => {
      if (done) await enqueue({ kind: 'checklist.add', itemId: item.id, forDate })
      else await enqueue({ kind: 'checklist.remove', itemId: item.id, forDate })
    },
    onMutate: async ({ item, done }) => {
      const key = keys.checklistCompletions(forDate)
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ChecklistItemCompletion[]>(key) ?? []

      queryClient.setQueryData<ChecklistItemCompletion[]>(key, (current = []) => {
        const without = current.filter((row) => row.item_id !== item.id)
        if (!done) return without
        return [
          ...without,
          {
            id: `optimistic-${item.id}`,
            family_id: item.family_id,
            item_id: item.id,
            task_id: item.task_id,
            child_id: '',
            for_date: forDate,
            completed_at: new Date().toISOString(),
          },
        ]
      })

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(keys.checklistCompletions(forDate), context.previous)
      }
    },
    onSettled: () => invalidateToday(queryClient, forDate),
  })
}

export function useSaveJournalEntry() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entry: {
      childId: string
      forDate: string
      mood: number | null
      note: string
    }) => {
      await enqueue({
        kind: 'journal.save',
        childId: entry.childId,
        forDate: entry.forDate,
        mood: entry.mood,
        note: entry.note,
      })
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: keys.journal(variables.childId) })
    },
  })
}
