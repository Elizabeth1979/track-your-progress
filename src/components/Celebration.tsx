import { useEffect, useState } from 'react'

const EMOJIS = ['🎉', '⭐', '🌟', '🎊', '💪', '🥳']

/**
 * A brief full-screen cheer after a completion. Purely decorative, so it is hidden from
 * assistive tech and disabled entirely under `prefers-reduced-motion`.
 */
export function useCelebration(): [boolean, () => void] {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setVisible(false), 1400)
    return () => window.clearTimeout(timer)
  }, [visible])

  return [visible, () => setVisible(true)]
}

export function Celebration({ show }: { show: boolean }) {
  const [emoji] = useState(() => EMOJIS[Math.floor(Math.random() * EMOJIS.length)])
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!show || reduced) return null

  return (
    <div className="celebration" aria-hidden="true">
      <span>{emoji}</span>
    </div>
  )
}
