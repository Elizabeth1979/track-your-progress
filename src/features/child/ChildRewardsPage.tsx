import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useRedemptions, useRewards, useStarBalances } from '@/lib/queries'
import { describeError, supabase } from '@/lib/supabase'
import { useT } from '@/i18n'
import { Banner, Button, Card, EmptyState, Spinner, StarBadge } from '@/components/ui'
import { Celebration, useCelebration } from '@/components/Celebration'
import type { Child } from '@/types/db'
import './rewards.css'

export function ChildRewardsPage() {
  const t = useT()
  const child = useOutletContext<Child>()
  const queryClient = useQueryClient()
  const { data: rewards, isPending } = useRewards()
  const { data: balances } = useStarBalances()
  const { data: redemptions } = useRedemptions()
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [celebrating, celebrate] = useCelebration()

  const balance = balances?.find((row) => row.child_id === child.id)?.stars_balance ?? 0
  const pendingIds = new Set(
    (redemptions ?? [])
      .filter((row) => row.child_id === child.id && row.status === 'pending')
      .map((row) => row.reward_id),
  )
  const pendingCost = (redemptions ?? [])
    .filter((row) => row.child_id === child.id && row.status === 'pending')
    .reduce((sum, row) => sum + row.star_cost, 0)
  const spendable = balance - pendingCost

  const request = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc('request_redemption', {
        p_child_id: child.id,
        p_reward_id: rewardId,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setMessage({ tone: 'success', text: t.rewards.requested })
      celebrate()
      void queryClient.invalidateQueries({ queryKey: keys.redemptions })
    },
    onError: (error) => {
      const code = describeError(error)
      setMessage({
        tone: 'error',
        text: code === 'not_enough_stars' ? t.rewards.notEnough : t.errors.generic,
      })
    },
  })

  if (isPending) {
    return (
      <main className="screen__body" id="main">
        <Spinner label={t.common.loading} />
      </main>
    )
  }

  const active = (rewards ?? []).filter((reward) => reward.is_active)

  return (
    <>
      <Celebration show={celebrating} />
      <header className="screen__header">
        <h1>{t.rewards.title}</h1>
      </header>

      <main className="screen__body" id="main">
        <Card className="balance-card">
          <span className="balance-card__stars" aria-hidden="true">
            ⭐
          </span>
          <span className="balance-card__value">{balance}</span>
          <span className="muted">{t.rewards.balance(balance)}</span>
        </Card>

        {message && <Banner tone={message.tone}>{message.text}</Banner>}

        {active.length === 0 ? (
          <EmptyState icon="🎁" title={t.rewards.emptyChild} />
        ) : (
          <ul className="reward-grid">
            {active.map((reward) => {
              const waiting = pendingIds.has(reward.id)
              const affordable = spendable >= reward.star_cost
              return (
                <li key={reward.id}>
                  <Card className="reward-card">
                    <span className="reward-card__icon" aria-hidden="true">
                      {reward.icon}
                    </span>
                    <span className="reward-card__title">{reward.title}</span>
                    <StarBadge count={reward.star_cost} />
                    <Button
                      fullWidth
                      variant={affordable && !waiting ? 'primary' : 'secondary'}
                      disabled={!affordable || waiting || request.isPending}
                      onClick={() => request.mutate(reward.id)}
                    >
                      {waiting
                        ? t.rewards.pending
                        : affordable
                          ? t.rewards.redeem
                          : t.rewards.notEnough}
                    </Button>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </>
  )
}
