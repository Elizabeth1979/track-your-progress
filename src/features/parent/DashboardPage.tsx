import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  keys,
  useChecklistItems,
  useChildren,
  useCompletions,
  useRedemptions,
  useRewards,
  useTasks,
} from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { dayOfWeek, todayKey } from '@/lib/dates'
import { useT } from '@/i18n'
import { Button, Card, EmptyState, ProgressRing, Spinner } from '@/components/ui'
import { Avatar } from '@/components/AvatarPicker'
import './parent.css'

export function DashboardPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const today = todayKey()
  const weekday = dayOfWeek(today)

  const { data: children, isPending: childrenPending } = useChildren()
  const { data: tasks } = useTasks()
  const { data: completions } = useCompletions(today)
  const { data: redemptions } = useRedemptions()
  const { data: rewards } = useRewards()
  useChecklistItems()

  const approveTask = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc('approve_completion', {
        p_completion_id: id,
        p_approve: approve,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.completions(today) })
      void queryClient.invalidateQueries({ queryKey: keys.balances })
    },
  })

  const resolveRedemption = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const { error } = await supabase.rpc('resolve_redemption', {
        p_redemption_id: id,
        p_approve: approve,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.redemptions })
      void queryClient.invalidateQueries({ queryKey: keys.balances })
    },
  })

  if (childrenPending) {
    return (
      <main className="screen__body" id="main">
        <Spinner label={t.common.loading} />
      </main>
    )
  }

  const pendingCompletions = (completions ?? []).filter(
    (row) => row.status === 'pending_approval',
  )
  const pendingRedemptions = (redemptions ?? []).filter((row) => row.status === 'pending')
  const nothingPending = pendingCompletions.length === 0 && pendingRedemptions.length === 0

  /*
   * Two opt-in features feed this section: tasks switched to "needs a parent's OK", and
   * reward redemptions. A family using neither can never see anything here, so the
   * section is hidden for them rather than sitting empty and unexplained.
   */
  const usesApprovals =
    (tasks ?? []).some((task) => task.requires_approval) || (rewards ?? []).length > 0
  const showApprovals = usesApprovals || !nothingPending

  function childName(childId: string) {
    return children?.find((child) => child.id === childId)?.name ?? ''
  }

  return (
    <>
      <header className="screen__header">
        <h1>{t.dashboard.title}</h1>
      </header>

      <main className="screen__body" id="main">
        <h2 className="section-title">{t.dashboard.todayProgress}</h2>
        {children && children.length > 0 ? (
          <ul className="list">
            {children.map((child) => {
              const childTasks = (tasks ?? []).filter(
                (task) =>
                  task.child_id === child.id &&
                  task.is_active &&
                  task.days_of_week.includes(weekday),
              )
              const done = childTasks.filter((task) =>
                (completions ?? []).some((row) => row.task_id === task.id),
              ).length

              return (
                <li key={child.id}>
                  <Card className="child-summary">
                    <Avatar emoji={child.avatar_emoji} color={child.avatar_color} />
                    <div className="grow">
                      <p className="list-row__title">{child.name}</p>
                      <p className="list-row__meta">
                        {t.myDay.progressLabel(done, childTasks.length)}
                      </p>
                    </div>
                    <ProgressRing value={done} total={childTasks.length} size={64} />
                  </Card>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon="👶"
            title={t.children.empty}
            action={
              <Link to="/parent/children">
                <Button variant="secondary">{t.children.addTitle}</Button>
              </Link>
            }
          />
        )}

        {showApprovals && (
          <>
            <h2 className="section-title">{t.dashboard.pendingApprovals}</h2>
            {nothingPending ? (
              <p className="section-note">{t.dashboard.noPending}</p>
            ) : (
              <ul className="list">
                {pendingCompletions.map((completion) => {
                  const task = tasks?.find((entry) => entry.id === completion.task_id)
                  return (
                    <li key={completion.id}>
                      <Card className="approval-row">
                        <span className="grow">
                          {t.dashboard.approveTask(
                            childName(completion.child_id),
                            task?.title ?? '',
                          )}
                        </span>
                        <Button
                          onClick={() =>
                            approveTask.mutate({ id: completion.id, approve: true })
                          }
                        >
                          {t.dashboard.approve}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            approveTask.mutate({ id: completion.id, approve: false })
                          }
                        >
                          {t.dashboard.reject}
                        </Button>
                      </Card>
                    </li>
                  )
                })}

                {pendingRedemptions.map((redemption) => (
                  <li key={redemption.id}>
                    <Card className="approval-row">
                      <span className="grow">
                        {t.dashboard.redemptionRequest(
                          childName(redemption.child_id),
                          redemption.reward_title,
                        )}{' '}
                        ⭐{redemption.star_cost}
                      </span>
                      <Button
                        onClick={() =>
                          resolveRedemption.mutate({ id: redemption.id, approve: true })
                        }
                      >
                        {t.dashboard.approve}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          resolveRedemption.mutate({ id: redemption.id, approve: false })
                        }
                      >
                        {t.dashboard.reject}
                      </Button>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h2 className="section-title">{t.dashboard.quickActions}</h2>
        <div className="settings-group">
          <Link className="settings-link" to="/parent/children">
            <span>👶 {t.nav.children}</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-link" to="/parent/routines">
            <span>🗓️ {t.nav.routines}</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-link" to="/parent/rewards">
            <span>🎁 {t.nav.rewards}</span>
            <span aria-hidden="true">›</span>
          </Link>
          <Link className="settings-link" to="/parent/journal">
            <span>📔 {t.nav.journal}</span>
            <span aria-hidden="true">›</span>
          </Link>
        </div>
      </main>
    </>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default DashboardPage
