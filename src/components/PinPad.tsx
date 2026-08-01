import { useState } from 'react'
import { useT } from '@/i18n'
import { Button } from './ui'
import './PinPad.css'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export function PinPad({
  title,
  subtitle,
  error,
  onComplete,
  onCancel,
}: {
  title: string
  subtitle?: string
  error?: string
  onComplete: (pin: string) => void
  onCancel?: () => void
}) {
  const t = useT()
  const [pin, setPin] = useState('')

  function press(key: string) {
    if (key === '⌫') {
      setPin((current) => current.slice(0, -1))
      return
    }
    if (!key || pin.length >= 4) return

    const next = pin + key
    setPin(next)
    if (next.length === 4) {
      onComplete(next)
      // Clear so a wrong code can be retyped immediately.
      window.setTimeout(() => setPin(''), 150)
    }
  }

  return (
    <div className="pinpad">
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}

      <div className="pinpad__dots" aria-label={`${pin.length}/4`}>
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className={index < pin.length ? 'is-filled' : ''} />
        ))}
      </div>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}

      <div className="pinpad__grid">
        {DIGITS.map((key, index) =>
          key ? (
            <button key={key} type="button" onClick={() => press(key)} aria-label={key}>
              {key}
            </button>
          ) : (
            <span key={`gap-${index}`} />
          ),
        )}
      </div>

      {onCancel && (
        <Button variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      )}
    </div>
  )
}
