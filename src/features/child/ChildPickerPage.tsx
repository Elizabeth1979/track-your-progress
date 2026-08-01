import { Link, useNavigate } from 'react-router-dom'
import { useChildren } from '@/lib/queries'
import { useMode } from '@/app/ModeProvider'
import { useT } from '@/i18n'
import { Button, EmptyState, Spinner } from '@/components/ui'
import { Avatar } from '@/components/AvatarPicker'
import './child.css'

export function ChildPickerPage() {
  const t = useT()
  const navigate = useNavigate()
  const { selectChild } = useMode()
  const { data: children, isPending } = useChildren()

  function open(childId: string) {
    selectChild(childId)
    void navigate(`/child/${childId}`)
  }

  return (
    <main className="picker-screen" id="main">
      <h1>{t.childPicker.title}</h1>
      <p className="muted">{t.childPicker.subtitle}</p>

      {isPending ? (
        <Spinner label={t.common.loading} />
      ) : children && children.length > 0 ? (
        <ul className="picker-grid">
          {children.map((child) => (
            <li key={child.id}>
              <button type="button" className="picker-card" onClick={() => open(child.id)}>
                <Avatar emoji={child.avatar_emoji} color={child.avatar_color} size="lg" />
                <span className="picker-card__name">{child.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="👶"
          title={t.childPicker.noChildren}
          action={
            <Link to="/parent/children">
              <Button variant="secondary">{t.childPicker.addFirstChild}</Button>
            </Link>
          }
        />
      )}

      <Link to="/parent" className="picker-parent-link">
        {t.childPicker.parentButton}
      </Link>
    </main>
  )
}
