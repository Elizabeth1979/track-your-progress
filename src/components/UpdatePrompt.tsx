import { useRegisterSW } from 'virtual:pwa-register/react'
import { useT } from '@/i18n'
import { Button } from './ui'

/** Service worker updates are opt-in so a child is never yanked mid-task by a reload. */
export function UpdatePrompt() {
  const t = useT()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  if (!needRefresh) return null

  return (
    <div className="update-prompt" role="status">
      <span>{t.update.available}</span>
      <div className="row">
        <Button size="md" onClick={() => void updateServiceWorker(true)}>
          {t.update.reload}
        </Button>
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          {t.common.close}
        </Button>
      </div>
    </div>
  )
}
