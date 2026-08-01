import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { useT } from '@/i18n'
import { Button, Field, Spinner, TextInput } from '@/components/ui'
import { Avatar, CHILD_COLORS, CHILD_EMOJIS, EmojiPicker } from '@/components/AvatarPicker'
import { AuthShell } from '@/features/auth/AuthShell'

type DraftChild = { name: string; emoji: string; color: string }

function nextDraft(index: number): DraftChild {
  return {
    name: '',
    emoji: CHILD_EMOJIS[index % CHILD_EMOJIS.length],
    color: CHILD_COLORS[index % CHILD_COLORS.length],
  }
}

export function OnboardingPage() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session, loading, profile, profileLoading, refreshProfile } = useAuth()

  const [familyName, setFamilyName] = useState('')
  const [drafts, setDrafts] = useState<DraftChild[]>([nextDraft(0)])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading || profileLoading) {
    return (
      <div className="center-screen">
        <Spinner label={t.common.loading} />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (profile) return <Navigate to="/child" replace />

  function updateDraft(index: number, patch: Partial<DraftChild>) {
    setDrafts((current) =>
      current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)),
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const named = drafts.filter((draft) => draft.name.trim().length > 0)
    if (named.length === 0) {
      setError(t.onboarding.needOneChild)
      return
    }

    setBusy(true)
    setError('')

    const { data: familyId, error: rpcError } = await supabase.rpc('create_family', {
      family_name: familyName.trim() || t.common.appName,
      display_name: session?.user.user_metadata.display_name ?? '',
    })

    if (rpcError || !familyId) {
      setBusy(false)
      setError(t.errors.generic)
      return
    }

    const { error: childError } = await supabase.from('children').insert(
      named.map((draft, index) => ({
        family_id: familyId,
        name: draft.name.trim(),
        avatar_emoji: draft.emoji,
        avatar_color: draft.color,
        sort_order: index,
      })),
    )

    setBusy(false)
    if (childError) {
      setError(t.errors.generic)
      return
    }

    // Joining a family changes the answer to every family-scoped query, and those
    // queries were already cached (and persisted) as empty from before the family
    // existed. Without a full invalidation the app keeps serving that empty snapshot,
    // and a refresh rehydrates it from localStorage rather than refetching.
    await refreshProfile()
    await queryClient.invalidateQueries()
    void navigate('/child', { replace: true })
  }

  return (
    <AuthShell title={t.onboarding.title} subtitle={t.onboarding.subtitle}>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label={t.onboarding.familyNameLabel} htmlFor="familyName">
          <TextInput
            id="familyName"
            required
            placeholder={t.onboarding.familyNamePlaceholder}
            value={familyName}
            onChange={(event) => setFamilyName(event.target.value)}
          />
        </Field>

        <h2 style={{ fontSize: 'var(--text-lg)' }}>{t.onboarding.childrenTitle}</h2>
        <p className="muted">{t.onboarding.childrenSubtitle}</p>

        <div className="stack" style={{ marginBlock: 'var(--space-4)' }}>
          {drafts.map((draft, index) => (
            <div key={index} className="card stack">
              <div className="row">
                <Avatar emoji={draft.emoji} color={draft.color} />
                <TextInput
                  aria-label={t.onboarding.childNamePlaceholder}
                  placeholder={t.onboarding.childNamePlaceholder}
                  value={draft.name}
                  onChange={(event) => updateDraft(index, { name: event.target.value })}
                />
              </div>
              <EmojiPicker
                label={t.common.emoji}
                options={CHILD_EMOJIS}
                value={draft.emoji}
                onChange={(emoji) => updateDraft(index, { emoji })}
              />
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => setDrafts((current) => [...current, nextDraft(current.length)])}
        >
          {t.onboarding.addChild}
        </Button>

        {error && (
          <p className="field__error" role="alert" style={{ marginBlock: 'var(--space-3)' }}>
            {error}
          </p>
        )}

        <Button
          type="submit"
          fullWidth
          size="lg"
          disabled={busy}
          style={{ marginBlockStart: 'var(--space-4)' }}
        >
          {busy ? t.common.loading : t.onboarding.finish}
        </Button>
      </form>
    </AuthShell>
  )
}
