import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, describeError } from '@/lib/supabase'
import { useT } from '@/i18n'
import { Banner, Button, Field, PasswordInput, TextInput } from '@/components/ui'
import { AuthShell } from './AuthShell'

export function SignupPage() {
  const t = useT()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() } },
    })
    setBusy(false)

    if (signUpError) {
      const code = describeError(signUpError)
      setError(
        code === 'email_in_use'
          ? t.auth.emailInUse
          : code === 'weak_password'
            ? t.auth.weakPassword
            : t.errors.generic,
      )
      return
    }

    // With email confirmation on, `session` is null until the user clicks the link.
    void navigate(data.session ? '/onboarding' : '/verify-email', { replace: true })
  }

  return (
    <AuthShell title={t.auth.signupTitle} footer={<Link to="/login">{t.auth.hasAccount}</Link>}>
      <Banner tone="info">{t.auth.parentOnlyNote}</Banner>
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Field label={t.auth.displayName} htmlFor="displayName">
          <TextInput
            id="displayName"
            autoComplete="name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </Field>
        <Field label={t.auth.email} htmlFor="email">
          <TextInput
            id="email"
            type="email"
            className="input--ltr"
            dir="ltr"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordHint} error={error}>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Button type="submit" fullWidth size="lg" disabled={busy}>
          {busy ? t.common.loading : t.auth.signup}
        </Button>
      </form>
    </AuthShell>
  )
}
