import type { ReactNode } from 'react'
import './auth.css'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <main className="auth" id="main">
      <div className="auth__card">
        <img className="auth__logo" src="/icons/favicon.svg" alt="" width="64" height="64" />
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
        {footer && <div className="auth__footer">{footer}</div>}
      </div>
    </main>
  )
}
