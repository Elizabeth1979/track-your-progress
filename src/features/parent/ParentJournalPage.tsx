import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChildren, useJournal } from '@/lib/queries'
import { formatDate } from '@/lib/dates'
import { useLocale, useT } from '@/i18n'
import { Card, EmptyState, SegmentedControl, Spinner } from '@/components/ui'
import '../child/rewards.css'
import './parent.css'

const MOOD_EMOJIS = ['😢', '🙁', '😐', '🙂', '😄']

export function ParentJournalPage() {
  const t = useT()
  const { locale } = useLocale()
  const { data: children } = useChildren()
  const [childId, setChildId] = useState<string>('')

  useEffect(() => {
    if (!childId && children && children.length > 0) setChildId(children[0].id)
  }, [childId, children])

  const { data: entries, isPending } = useJournal(childId || null)

  return (
    <>
      <header className="screen__header">
        <Link className="back-link" to="/parent" aria-label={t.common.back} />
        <h1>{t.journal.parentTitle}</h1>
      </header>

      <main className="screen__body" id="main">
        {children && children.length > 1 && (
          <SegmentedControl
            ariaLabel={t.taskForm.childLabel}
            value={childId}
            onChange={setChildId}
            options={children.map((child) => ({ value: child.id, label: child.name }))}
          />
        )}

        {isPending ? (
          <Spinner label={t.common.loading} />
        ) : !entries || entries.length === 0 ? (
          <EmptyState icon="📔" title={t.journal.empty} />
        ) : (
          <ul className="journal-list">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card className="journal-entry">
                  <span className="journal-entry__mood" aria-hidden="true">
                    {entry.mood ? MOOD_EMOJIS[entry.mood - 1] : '·'}
                  </span>
                  <div className="grow">
                    <p className="journal-entry__date">{formatDate(entry.for_date, locale)}</p>
                    {entry.note && <p>{entry.note}</p>}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
