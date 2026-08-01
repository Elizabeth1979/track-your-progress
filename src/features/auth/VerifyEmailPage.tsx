import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { AuthShell } from './AuthShell'

export function VerifyEmailPage() {
  const t = useT()
  return (
    <AuthShell
      title={t.auth.verifyTitle}
      subtitle={t.auth.verifyBody}
      footer={<Link to="/login">{t.auth.backToLogin}</Link>}
    >
      <p aria-hidden="true" style={{ fontSize: '3rem', textAlign: 'center' }}>
        📬
      </p>
    </AuthShell>
  )
}
