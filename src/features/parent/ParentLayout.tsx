import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { keys, useFamily } from '@/lib/queries'
import { isParentUnlocked, markParentUnlocked, verifyPin } from '@/lib/pin'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/AuthProvider'
import { useT } from '@/i18n'
import { PinPad } from '@/components/PinPad'
import { AuthShell } from '@/features/auth/AuthShell'
import { Banner, Button, Field, PasswordInput, Spinner } from '@/components/ui'
import './parent.css'

const TABS = [
  { to: '/parent', end: true, icon: '🏠', key: 'dashboard' },
  { to: '/parent/tasks', end: false, icon: '📋', key: 'tasks' },
  { to: '/parent/progress', end: false, icon: '📈', key: 'progress' },
  { to: '/parent/settings', end: false, icon: '⚙️', key: 'settings' },
] as const

export function ParentLayout() {
  const t = useT()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const { data: family, isPending } = useFamily()
  const [unlocked, setUnlocked] = useState(() => isParentUnlocked())
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [password, setPassword] = useState('')
  const [resetBusy, setResetBusy] = useState(false)

  // Re-lock when the app goes to the background so a handed-over phone is safe.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') setUnlocked(isParentUnlocked())
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  if (isPending) {
    return (
      <div className="center-screen">
        <Spinner label={t.common.loading} />
      </div>
    )
  }

  const pinRequired = Boolean(family?.parent_pin_hash) && !unlocked

  /**
   * Recovery for a forgotten PIN. The account password is the thing a parent knows and
   * a child does not, so re-entering it is what authorises clearing the PIN. Verified
   * against Supabase rather than anything stored locally.
   */
  if (pinRequired && resetting && family) {
    return (
      <div className="center-screen">
        <AuthShell title={t.pin.forgotTitle} subtitle={t.pin.forgotBody}>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void (async () => {
                setResetBusy(true)
                setError('')
                const email = session?.user.email
                if (!email) return
                const { error: authError } = await supabase.auth.signInWithPassword({
                  email,
                  password,
                })
                if (authError) {
                  setResetBusy(false)
                  setError(t.pin.forgotWrong)
                  return
                }
                const { error: clearError } = await supabase
                  .from('families')
                  .update({ parent_pin_hash: null })
                  .eq('id', family.id)
                setResetBusy(false)
                if (clearError) {
                  setError(t.errors.generic)
                  return
                }
                await queryClient.invalidateQueries({ queryKey: keys.family })
                markParentUnlocked()
                setUnlocked(true)
                setResetting(false)
                setPassword('')
              })()
            }}
          >
            <Field label={t.auth.password} htmlFor="reset-password" error={error}>
              <PasswordInput
                id="reset-password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Button type="submit" fullWidth size="lg" disabled={resetBusy || !password}>
              {resetBusy ? t.common.loading : t.pin.forgotConfirm}
            </Button>
          </form>
          <Button variant="ghost" fullWidth onClick={() => setResetting(false)}>
            {t.common.cancel}
          </Button>
        </AuthShell>
      </div>
    )
  }

  if (pinRequired && family) {
    return (
      <div className="center-screen">
        <PinPad
          title={t.pin.enterTitle}
          error={error}
          onCancel={() => void navigate('/child')}
          secondaryAction={
            <button type="button" className="pin-forgot" onClick={() => setResetting(true)}>
              {t.pin.forgot}
            </button>
          }
          onComplete={(pin) => {
            void verifyPin(pin, family.id, family.parent_pin_hash!).then((ok) => {
              if (ok) {
                markParentUnlocked()
                setUnlocked(true)
                setError('')
              } else {
                setError(t.pin.wrong)
              }
            })
          }}
        />
      </div>
    )
  }

  const labels: Record<string, string> = {
    dashboard: t.nav.dashboard,
    tasks: t.nav.tasks,
    progress: t.nav.progress,
    settings: t.nav.settings,
  }

  return (
    <div className="screen">
      {/* Without a PIN this whole area is open to whoever is holding the phone. */}
      {!family?.parent_pin_hash && (
        <Banner tone="warn">
          {t.pin.notSetWarning}{' '}
          <Link to="/parent/settings">{t.pin.notSetAction}</Link>
        </Banner>
      )}
      <Outlet />
      <nav className="tabbar" aria-label={t.nav.parentArea}>
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}
          >
            <span className="tabbar__icon" aria-hidden="true">
              {tab.icon}
            </span>
            {labels[tab.key]}
          </NavLink>
        ))}
        <Link to="/child" className="tabbar__item">
          <span className="tabbar__icon" aria-hidden="true">
            👦
          </span>
          {t.nav.exitParentMode}
        </Link>
      </nav>
    </div>
  )
}
