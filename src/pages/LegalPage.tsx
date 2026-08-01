import { Link } from 'react-router-dom'
import { useLocale, useT } from '@/i18n'
import { Button, SegmentedControl } from '@/components/ui'
import { useState } from 'react'
import { LAST_UPDATED } from './legal-content'
import './legal.css'

type Section = { heading: string; body: string[] }

/** Shared shell for the public policy pages, with its own he/en switch so a reviewer
 *  or a co-parent can read them without changing the whole app's language. */
export function LegalPage({
  title,
  he,
  en,
}: {
  title: string
  he: Section[]
  en: Section[]
}) {
  const t = useT()
  const { locale } = useLocale()
  const [lang, setLang] = useState<'he' | 'en'>(locale)
  const sections = lang === 'he' ? he : en

  return (
    <main className="legal" id="main" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <div className="legal__inner">
        <Link to="/" className="legal__back">
          {t.legal.backHome}
        </Link>

        <SegmentedControl
          ariaLabel="language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'he', label: 'עברית' },
            { value: 'en', label: 'English' },
          ]}
        />

        <h1>{title}</h1>
        <p className="muted">
          {t.legal.lastUpdated}: {LAST_UPDATED}
        </p>

        {sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}

        <Link to="/">
          <Button variant="secondary">{t.legal.backHome}</Button>
        </Link>
      </div>
    </main>
  )
}
