import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { Button, EmptyState } from '@/components/ui'

export function NotFoundPage() {
  const t = useT()
  return (
    <main className="center-screen" id="main">
      <EmptyState
        icon="🧭"
        title={`${t.errors.notFound} — ${t.errors.notFoundBody}`}
        action={
          <Link to="/">
            <Button>{t.legal.backHome}</Button>
          </Link>
        }
      />
    </main>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default NotFoundPage
