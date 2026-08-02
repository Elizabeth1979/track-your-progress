import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useChildren } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { useT } from '@/i18n'
import { Button, Card, EmptyState, Field, Spinner, TextInput } from '@/components/ui'
import { Avatar, CHILD_COLORS, CHILD_EMOJIS, ColorPicker, EmojiPicker } from '@/components/AvatarPicker'
import { ConfirmDialog, Modal } from '@/components/Modal'
import type { Child } from '@/types/db'
import './parent.css'

type Draft = { id?: string; name: string; emoji: string; color: string }

export function ChildrenPage() {
  const t = useT()
  const { familyId } = useAuth()
  const queryClient = useQueryClient()
  const { data: children, isPending } = useChildren()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<Child | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: keys.children })
  }

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      if (value.id) {
        const { error } = await supabase
          .from('children')
          .update({ name: value.name.trim(), avatar_emoji: value.emoji, avatar_color: value.color })
          .eq('id', value.id)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('children').insert({
        family_id: familyId!,
        name: value.name.trim(),
        avatar_emoji: value.emoji,
        avatar_color: value.color,
        sort_order: children?.length ?? 0,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setDraft(null)
      invalidate()
    },
  })

  const remove = useMutation({
    mutationFn: async (childId: string) => {
      const { error } = await supabase.from('children').delete().eq('id', childId)
      if (error) throw error
    },
    onSuccess: () => {
      setToDelete(null)
      invalidate()
      void queryClient.invalidateQueries({ queryKey: keys.tasks })
    },
  })

  return (
    <>
      <header className="screen__header">
        <Link className="back-link" to="/parent" aria-label={t.common.back} />
        <h1>{t.children.title}</h1>
      </header>

      <main className="screen__body" id="main">
        {isPending ? (
          <Spinner label={t.common.loading} />
        ) : children && children.length > 0 ? (
          <ul className="list">
            {children.map((child) => (
              <li key={child.id}>
                <Card className="list-row">
                  <Avatar emoji={child.avatar_emoji} color={child.avatar_color} />
                  <span className="list-row__text list-row__title">{child.name}</span>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: child.id,
                        name: child.name,
                        emoji: child.avatar_emoji,
                        color: child.avatar_color,
                      })
                    }
                  >
                    {t.common.edit}
                  </Button>
                  <Button variant="ghost" onClick={() => setToDelete(child)}>
                    🗑️
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon="👶" title={t.children.empty} />
        )}

        <Button
          fullWidth
          variant="secondary"
          onClick={() =>
            setDraft({
              name: '',
              emoji: CHILD_EMOJIS[(children?.length ?? 0) % CHILD_EMOJIS.length],
              color: CHILD_COLORS[(children?.length ?? 0) % CHILD_COLORS.length],
            })
          }
        >
          {t.children.addTitle}
        </Button>
      </main>

      <Modal
        open={draft !== null}
        title={draft?.id ? t.children.editTitle : t.children.addTitle}
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
        {draft && (
          <>
            <div className="row row--center">
              <Avatar emoji={draft.emoji} color={draft.color} size="lg" />
            </div>
            <Field label={t.children.nameLabel} htmlFor="childName">
              <TextInput
                id="childName"
                value={draft.name}
                maxLength={40}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label={t.common.emoji}>
              <EmojiPicker
                label={t.common.emoji}
                options={CHILD_EMOJIS}
                value={draft.emoji}
                onChange={(emoji) => setDraft({ ...draft, emoji })}
              />
            </Field>
            <Field label={t.common.color}>
              <ColorPicker
                label={t.common.color}
                value={draft.color}
                onChange={(color) => setDraft({ ...draft, color })}
              />
            </Field>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={toDelete !== null}
        destructive
        title={t.children.deleteConfirmTitle}
        body={toDelete ? t.children.deleteConfirmBody(toDelete.name) : ''}
        confirmLabel={t.common.delete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default ChildrenPage
