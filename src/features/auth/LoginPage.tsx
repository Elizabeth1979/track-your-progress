import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, describeError } from '@/lib/supabase'
import { useT } from '@/i18n'
import { Button, Field, TextInput } from '@/components/ui'
import { AuthShell } from './AuthShell'

export function LoginPage() {
  const t = useT()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Set by links that need auth first, e.g. a co-parent opening an invite.
  const next = searchParams.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)

    if (signInError) {
      const code = describeError(signInError)
      setError(code === 'invalid_credentials' ? t.auth.invalidCredentials : t.errors.generic)
      return
    }
    void navigate(next && next.startsWith('/') ? next : '/', { replace: true })
  }

  return (
    <AuthShell
      title={t.auth.loginTitle}
      footer={
        <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}>
          {t.auth.noAccount}
        </Link>
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label={t.auth.email} htmlFor="email">
          <TextInput
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={t.auth.password} htmlFor="password" error={error}>
          <TextInput
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? t.common.loading : t.auth.login}
        </Button>
      </form>
    </AuthShell>
  )
}
