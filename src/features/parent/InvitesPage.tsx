import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { keys, useInvites } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import {
  INVITE_TTL_DAYS,
  generateInviteCode,
  generateInviteToken,
  hashInviteToken,
  inviteUrl,
} from '@/lib/invites'
import { formatDateTime } from '@/lib/dates'
import { useLocale, useT } from '@/i18n'
import { Banner, Button, Card, EmptyState, Spinner } from '@/components/ui'
import './parent.css'

export function InvitesPage() {
  const t = useT()
  const { locale } = useLocale()
  const { familyId, session } = useAuth()
  const queryClient = useQueryClient()
  const { data: invites, isPending } = useInvites()

  // The plaintext token only exists in memory right after creation; it is never stored.
  const [freshLink, setFreshLink] = useState<{ code: string; url: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useMutation({
    mutationFn: async () => {
      const code = generateInviteCode()
      const token = generateInviteToken()
      const expires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

      const { error } = await supabase.from('invites').insert({
        family_id: familyId!,
        code,
        token_hash: await hashInviteToken(token),
        expires_at: expires.toISOString(),
        created_by: session!.user.id,
      })
      if (error) throw error

      return { code, url: inviteUrl(code, token) }
    },
    onSuccess: (value) => {
      setFreshLink(value)
      setCopied(false)
      void queryClient.invalidateQueries({ queryKey: keys.invites })
    },
  })

  const revoke = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId)
      if (error) throw error
    },
    onSuccess: () => {
      setFreshLink(null)
      void queryClient.invalidateQueries({ queryKey: keys.invites })
    },
  })

  async function share() {
    if (!freshLink) return
    if (navigator.share) {
      try {
        await navigator.share({ title: t.common.appName, url: freshLink.url })
        return
      } catch {
        // Falls through to clipboard when the user dismisses the share sheet.
      }
    }
    await navigator.clipboard.writeText(freshLink.url)
    setCopied(true)
  }

  return (
    <>
      <header className="screen__header">
        <Link className="back-link" to="/parent/settings" aria-label={t.common.back} />
        <h1>{t.invites.title}</h1>
      </header>

      <main className="screen__body" id="main">
        <p className="muted">{t.invites.subtitle}</p>
        <Banner tone="info">{t.invites.childCannotJoin}</Banner>

        {freshLink && (
          <Card className="stack">
            <p className="section-title">{t.invites.codeLabel}</p>
            <p className="invite-code">{freshLink.code}</p>
            <Button fullWidth onClick={() => void share()}>
              {copied ? t.common.copied : t.common.share}
            </Button>
            <p className="muted" style={{ wordBreak: 'break-all' }}>
              {freshLink.url}
            </p>
          </Card>
        )}

        <Button fullWidth variant="secondary" disabled={create.isPending} onClick={() => create.mutate()}>
          {t.invites.create}
        </Button>

        <h2 className="section-title">{t.invites.activeTitle}</h2>
        {isPending ? (
          <Spinner label={t.common.loading} />
        ) : !invites || invites.length === 0 ? (
          <EmptyState icon="✉️" title={t.invites.empty} />
        ) : (
          <ul className="list">
            {invites.map((invite) => (
              <li key={invite.id}>
                <Card className="list-row">
                  <span className="list-row__text">
                    <span className="list-row__title">{invite.code}</span>
                    <span className="list-row__meta">
                      {t.invites.expires(formatDateTime(invite.expires_at, locale))}
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => revoke.mutate(invite.id)}>
                    {t.invites.revoke}
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default InvitesPage
