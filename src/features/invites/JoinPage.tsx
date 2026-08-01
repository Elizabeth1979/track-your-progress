import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { describeError, supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { useT } from '@/i18n'
import { Banner, Button, Spinner } from '@/components/ui'
import { AuthShell } from '@/features/auth/AuthShell'

export function JoinPage() {
  const t = useT()
  const navigate = useNavigate()
  const { code } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t') ?? ''
  const { session, loading, profile, profileLoading, refreshProfile } = useAuth()

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading || (session && profileLoading)) {
    return (
      <div className="center-screen">
        <Spinner label={t.common.loading} />
      </div>
    )
  }

  // Signing in has to happen first; the link is preserved so we return here afterwards.
  if (!session) {
    const next = `/join/${code ?? ''}?t=${encodeURIComponent(token)}`
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />
  }

  if (profile) {
    return (
      <AuthShell title={t.invites.joinTitle}>
        <Banner tone="warn">{t.invites.joinAlreadyInFamily}</Banner>
        <Link to="/">
          <Button fullWidth>{t.legal.backHome}</Button>
        </Link>
      </AuthShell>
    )
  }

  async function accept() {
    setBusy(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('accept_invite', {
      invite_code: code ?? '',
      invite_token: token,
    })
    setBusy(false)

    if (rpcError) {
      const kind = describeError(rpcError)
      setError(kind === 'already_in_family' ? t.invites.joinAlreadyInFamily : t.invites.joinInvalid)
      return
    }

    await refreshProfile()
    void navigate('/parent', { replace: true })
  }

  return (
    <AuthShell title={t.invites.joinTitle} subtitle={t.invites.joinBody}>
      <p className="invite-code">{code}</p>
      {error && <Banner tone="error">{error}</Banner>}
      <Button fullWidth size="lg" disabled={busy || !token} onClick={() => void accept()}>
        {busy ? t.common.loading : t.invites.joinAccept}
      </Button>
      {!token && <Banner tone="error">{t.invites.joinInvalid}</Banner>}
    </AuthShell>
  )
}
