import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useChildren, useRedemptions, useRewards } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { formatDateTime } from '@/lib/dates'
import { useLocale, useT } from '@/i18n'
import { Button, Card, EmptyState, Field, Spinner, StarBadge, TextInput } from '@/components/ui'
import { EmojiPicker, REWARD_EMOJIS } from '@/components/AvatarPicker'
import { ConfirmDialog, Modal } from '@/components/Modal'
import type { Reward } from '@/types/db'
import './parent.css'

type Draft = { id?: string; title: string; icon: string; cost: number }

export function RewardsPage() {
  const t = useT()
  const { locale } = useLocale()
  const { familyId } = useAuth()
  const queryClient = useQueryClient()
  const { data: rewards, isPending } = useRewards()
  const { data: redemptions } = useRedemptions()
  const { data: children } = useChildren()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<Reward | null>(null)

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        family_id: familyId!,
        title: value.title.trim(),
        icon: value.icon,
        star_cost: Math.max(1, value.cost),
      }
      const { error } = value.id
        ? await supabase.from('rewards').update(payload).eq('id', value.id)
        : await supabase.from('rewards').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setDraft(null)
      void queryClient.invalidateQueries({ queryKey: keys.rewards })
    },
  })

  const remove = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.from('rewards').delete().eq('id', rewardId)
      if (error) throw error
    },
    onSuccess: () => {
      setToDelete(null)
      void queryClient.invalidateQueries({ queryKey: keys.rewards })
    },
  })

  const history = (redemptions ?? []).filter((row) => row.status !== 'pending').slice(0, 20)

  return (
    <>
      <header className="screen__header">
        <Link className="back-link" to="/parent" aria-label={t.common.back} />
        <h1>{t.rewards.catalogTitle}</h1>
      </header>

      <main className="screen__body" id="main">
        {isPending ? (
          <Spinner label={t.common.loading} />
        ) : rewards && rewards.length > 0 ? (
          <ul className="list">
            {rewards.map((reward) => (
              <li key={reward.id}>
                <Card className="list-row">
                  <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                    {reward.icon}
                  </span>
                  <span className="list-row__text list-row__title">{reward.title}</span>
                  <StarBadge count={reward.star_cost} />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: reward.id,
                        title: reward.title,
                        icon: reward.icon,
                        cost: reward.star_cost,
                      })
                    }
                  >
                    {t.common.edit}
                  </Button>
                  <Button variant="ghost" onClick={() => setToDelete(reward)}>
                    🗑️
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="🎁" title={t.rewards.empty} />
        )}

        <Button
          fullWidth
          variant="secondary"
          onClick={() => setDraft({ title: '', icon: '🎁', cost: 10 })}
        >
          {t.rewards.newTitle}
        </Button>

        {history.length > 0 && (
          <>
            <h2 className="section-title">{t.rewards.historyTitle}</h2>
            <ul className="list">
              {history.map((row) => (
                <li key={row.id}>
                  <Card className="list-row">
                    <span className="list-row__text">
                      <span className="list-row__title">{row.reward_title}</span>
                      <span className="list-row__meta">
                        {children?.find((child) => child.id === row.child_id)?.name} ·{' '}
                        {row.status === 'approved'
                          ? t.rewards.statusApproved
                          : t.rewards.statusRejected}{' '}
                        · {formatDateTime(row.resolved_at ?? row.requested_at, locale)}
                      </span>
                    </span>
                    <StarBadge count={row.star_cost} />
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      <Modal
        open={draft !== null}
        title={draft?.id ? t.rewards.editTitle : t.rewards.newTitle}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={!draft?.title.trim() || save.isPending}
              onClick={() => draft && save.mutate(draft)}
            >
              {t.common.save}
            </Button>
          </>
        }
      >
        {draft && (
          <>
            <Field label={t.rewards.nameLabel} htmlFor="rewardName">
              <TextInput
                id="rewardName"
                maxLength={80}
                placeholder={t.rewards.namePlaceholder}
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              />
            </Field>
            <Field label={t.rewards.costLabel} htmlFor="rewardCost">
              <TextInput
                id="rewardCost"
                type="number"
                min={1}
                max={10000}
                value={draft.cost}
                onChange={(event) => setDraft({ ...draft, cost: Number(event.target.value) })}
              />
            </Field>
            <Field label={t.taskForm.iconLabel}>
              <EmojiPicker
                label={t.taskForm.iconLabel}
                options={REWARD_EMOJIS}
                value={draft.icon}
                onChange={(icon) => setDraft({ ...draft, icon })}
              />
            </Field>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        destructive
        title={t.common.delete}
        body={t.rewards.deleteConfirm}
        confirmLabel={t.common.delete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default RewardsPage
