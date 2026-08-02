import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { Banner, Button, Card } from '@/components/ui'
import './legal.css'

type InstallPromptEvent = Event & { prompt: () => Promise<void> }

export function InstallPage() {
  const t = useT()
  const [deferred, setDeferred] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )

  // Chrome hands us the install prompt to re-fire on our own button.
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)

    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const platforms = [
    { title: t.install.androidTitle, steps: t.install.androidSteps },
    { title: t.install.iosTitle, steps: t.install.iosSteps },
    { title: t.install.desktopTitle, steps: t.install.desktopSteps },
  ]

  return (
    <main className="legal" id="main">
      <div className="legal__inner">
        <Link to="/" className="legal__back">
          {t.legal.backHome}
        </Link>
        <h1>{t.install.title}</h1>
        <p>{t.install.intro}</p>

        {installed && <Banner tone="success">{t.install.installed}</Banner>}

        {deferred && !installed && (
          <Button
            size="lg"
            onClick={() => {
              void deferred.prompt()
              setDeferred(null)
            }}
          >
            {t.install.installButton}
          </Button>
        )}

        {platforms.map((platform) => (
          <Card key={platform.title}>
            <h2>{platform.title}</h2>
            <ol className="install-steps">
              {platform.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </Card>
        ))}

        <Banner tone="info">{t.push.iosHint}</Banner>
      </div>
    </main>
  )
}

// Default export so the router can code-split this page into its own chunk.
export default InstallPage
