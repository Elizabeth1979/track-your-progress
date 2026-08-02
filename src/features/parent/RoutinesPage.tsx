import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useChildren, useRoutines, useTasks } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { useT } from '@/i18n'
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Field,
  SegmentedControl,
  Spinner,
  TextInput,
} from '@/components/ui'
import { EmojiPicker } from '@/components/AvatarPicker'
import { ConfirmDialog, Modal } from '@/components/Modal'
import type { Routine, TimeSlot } from '@/types/db'
import './parent.css'

const ROUTINE_EMOJIS = ['🗓️', '🌅', '🌙', '🎒', '🍽️', '🛁', '📚', '🏃']

type Draft = { id?: string; childId: string; name: string; icon: string; slot: TimeSlot }

export function RoutinesPage() {
  const t = useT()
  const { familyId } = useAuth()
  const queryClient = useQueryClient()
  const { data: children } = useChildren()
  const { data: routines, isPending } = useRoutines()
  const { data: tasks } = useTasks()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<Routine | null>(null)

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const payload = {
        family_id: familyId!,
        child_id: value.childId,
        name: value.name.trim(),
        icon: value.icon,
        time_slot: value.slot,
      }
      const { error } = value.id
        ? await supabase.from('routines').update(payload).eq('id', value.id)
        : await supabase.from('routines').insert(payload)
      if (error) throw error
    },
    onSuccess: () => {
      setDraft(null)
      void queryClient.invalidateQueries({ queryKey: keys.routines })
    },
  })

  const remove = useMutation({
    mutationFn: async (routineId: string) => {
      const { error } = await supabase.from('routines').delete().eq('id', routineId)
      if (error) throw error
    },
    onSuccess: () => {
      setToDelete(null)
      void queryClient.invalidateQueries({ queryKey: keys.routines })
      void queryClient.invalidateQueries({ queryKey: keys.tasks })
    },
  })

  const slotLabel: Record<TimeSlot, string> = {
    morning: t.myDay.slotMorning,
    afternoon: t.myDay.slotAfternoon,
    evening: t.myDay.slotEvening,
  }

  return (
    <>
      <header className="screen__header">
        <Link className="back-link" to="/parent" aria-label={t.common.back} />
        <h1>{t.routines.title}</h1>
      </header>

      <main className="screen__body" id="main">
        <Banner tone="info">{t.routines.hint}</Banner>

        {isPending ? (
          <Spinner label={t.common.loading} />
        ) : routines && routines.length > 0 ? (
          <ul className="list">
            {routines.map((routine) => {
              const child = children?.find((entry) => entry.id === routine.child_id)
              const count = (tasks ?? []).filter((task) => task.routine_id === routine.id).length
              return (
                <li key={routine.id}>
                  <Card className="list-row">
                    <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
                      {routine.icon}
                    </span>
                    <span className="list-row__text">
                      <span className="list-row__title">{routine.name}</span>
                      <span className="list-row__meta">
                        {child?.name} · {slotLabel[routine.time_slot]} · {count} {t.nav.tasks}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setDraft({
                          id: routine.id,
                          childId: routine.child_id,
                          name: routine.name,
                          icon: routine.icon,
                          slot: routine.time_slot,
                        })
                      }
                    >
                      {t.common.edit}
                    </Button>
                    <Button variant="ghost" onClick={() => setToDelete(routine)}>
                      🗑️
                    </Button>
                  </Card>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState icon="🗓️" title={t.routines.empty} />
        )}

        <Button
          fullWidth
          variant="secondary"
          disabled={!children || children.length === 0}
          onClick={() =>
            setDraft({
              childId: children![0].id,
              name: '',
              icon: '🗓️',
              slot: 'evening',
            })
          }
        >
          {t.routines.newTitle}
        </Button>
      </main>

      <Modal
        open={draft !== null}
        title={draft?.id ? t.routines.editTitle : t.routines.newTitle}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDraft(null)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={!draft?.name.trim() || save.isPending}
              onClick={() => draft && save.mutate(draft)}
            >
              {t.common.save}
            </Button>
          </>
        }
      >
        {draft && children && (
          <>
            <Field label={t.routines.nameLabel} htmlFor="routineName">
              <TextInput
                id="routineName"
                maxLength={60}
                placeholder={t.routines.namePlaceholder}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label={t.taskForm.childLabel}>
              <SegmentedControl
                ariaLabel={t.taskForm.childLabel}
                value={draft.childId}
                onChange={(childId) => setDraft({ ...draft, childId })}
                options={children.map((child) => ({ value: child.id, label: child.name }))}
              />
            </Field>
            <Field label={t.taskForm.slotLabel}>
              <SegmentedControl
                ariaLabel={t.taskForm.slotLabel}
                value={draft.slot}
                onChange={(slot) => setDraft({ ...draft, slot })}
                options={[
                  { value: 'morning', label: t.myDay.slotMorning },
                  { value: 'afternoon', label: t.myDay.slotAfternoon },
                  { value: 'evening', label: t.myDay.slotEvening },
                ]}
              />
            </Field>
            <Field label={t.taskForm.iconLabel}>
              <EmojiPicker
                label={t.taskForm.iconLabel}
                options={ROUTINE_EMOJIS}
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
        body={t.routines.deleteConfirm}
        confirmLabel={t.common.delete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default RoutinesPage
