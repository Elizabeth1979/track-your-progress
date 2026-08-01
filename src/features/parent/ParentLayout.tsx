import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useFamily } from '@/lib/queries'
import { isParentUnlocked, markParentUnlocked, verifyPin } from '@/lib/pin'
import { useT } from '@/i18n'
import { PinPad } from '@/components/PinPad'
import { Spinner } from '@/components/ui'
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
  const { data: family, isPending } = useFamily()
  const [unlocked, setUnlocked] = useState(() => isParentUnlocked())
  const [error, setError] = useState('')

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

  if (pinRequired && family) {
    return (
      <div className="center-screen">
        <PinPad
          title={t.pin.enterTitle}
          error={error}
          onCancel={() => void navigate('/child')}
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
