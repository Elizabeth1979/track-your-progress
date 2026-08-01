import { useChildren, useCompletionsRange, useStarBalances, useTasks } from '@/lib/queries'
import { lastNDays, todayKey, weekOf } from '@/lib/dates'
import { useT } from '@/i18n'
import { Card, EmptyState, Spinner, StarBadge } from '@/components/ui'
import { Avatar } from '@/components/AvatarPicker'
import { completionRate, currentStreak, dayStats } from './streaks'
import './parent.css'

export function ProgressPage() {
  const t = useT()
  const today = todayKey()
  const window35 = lastNDays(35, today)
  const week = weekOf(today)

  const { data: children, isPending } = useChildren()
  const { data: tasks } = useTasks()
  const { data: completions } = useCompletionsRange(window35[0], today)
  const { data: balances } = useStarBalances()

  if (isPending) {
    return (
      <main className="screen__body" id="main">
        <Spinner label={t.common.loading} />
      </main>
    )
  }

  return (
    <>
      <header className="screen__header">
        <h1>{t.progress.title}</h1>
      </header>

      <main className="screen__body" id="main">
        {!children || children.length === 0 ? (
          <EmptyState icon="📈" title={t.children.empty} />
        ) : (
          children.map((child) => {
            const stats = dayStats(tasks ?? [], completions ?? [], child.id, window35)
            const weekStats = stats.filter((stat) => week.includes(stat.dateKey))
            const streak = currentStreak(stats, today)
            const rate = completionRate(stats.filter((stat) => stat.dateKey <= today))
            const stars = balances?.find((row) => row.child_id === child.id)?.stars_balance ?? 0

            return (
              <Card key={child.id} className="stack">
                <div className="row">
                  <Avatar emoji={child.avatar_emoji} color={child.avatar_color} />
                  <div className="grow">
                    <p className="list-row__title">{child.name}</p>
                    <p className="list-row__meta">
                      {streak > 0 ? t.progress.streak(streak) : t.progress.noStreak}
                    </p>
                  </div>
                  <StarBadge count={stars} />
                </div>

                <div className="week-grid" aria-label={t.progress.weekly}>
                  {week.map((dateKey, index) => (
                    <span key={`label-${dateKey}`} className="week-grid__label">
                      {t.days.short[index]}
                    </span>
                  ))}
                  {week.map((dateKey) => {
                    const stat = weekStats.find((entry) => entry.dateKey === dateKey)
                    const ratio = stat?.ratio ?? 0
                    const future = dateKey > today
                    return (
                      <span
                        key={dateKey}
                        className="week-grid__cell"
                        title={`${dateKey}: ${stat?.done ?? 0}/${stat?.scheduled ?? 0}`}
                        style={{
                          background: future
                            ? 'var(--bg-sunken)'
                            : ratio === 0
                              ? 'var(--bg-sunken)'
                              : `color-mix(in srgb, var(--green-500) ${Math.round(ratio * 80) + 20}%, var(--bg-sunken))`,
                          color: ratio > 0.5 ? '#fff' : 'var(--text-muted)',
                        }}
                      >
                        {future ? '' : (stat?.done ?? 0)}
                      </span>
                    )
                  })}
                </div>

                <div className="row row--between">
                  <span className="muted">
                    {t.progress.completionRate} ({t.progress.last7.replace('7', '35')})
                  </span>
                  <strong>{rate}%</strong>
                </div>
              </Card>
            )
          })
        )}
      </main>
    </>
  )
}
