import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useJournal, useSaveJournalEntry } from '@/lib/queries'
import { formatDate, todayKey } from '@/lib/dates'
import { useLocale, useT } from '@/i18n'
import { Banner, Button, Card, EmptyState, Field, Spinner, TextArea } from '@/components/ui'
import type { Child } from '@/types/db'
import './rewards.css'

const MOOD_EMOJIS = ['😢', '🙁', '😐', '🙂', '😄']

export function ChildJournalPage() {
  const t = useT()
  const { locale } = useLocale()
  const child = useOutletContext<Child>()
  const today = todayKey()
  const { data: entries, isPending } = useJournal(child.id)
  const save = useSaveJournalEntry()

  const todayEntry = entries?.find((entry) => entry.for_date === today)
  const [mood, setMood] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  // Seed the form from the server copy once it arrives, without stomping on typing.
  useEffect(() => {
    if (!todayEntry) return
    setMood((current) => current ?? todayEntry.mood)
    setNote((current) => (current.length === 0 ? (todayEntry.note ?? '') : current))
  }, [todayEntry])

  function onSave() {
    save.mutate(
      { childId: child.id, forDate: today, mood, note: note.trim() },
      {
        onSuccess: () => {
          setSaved(true)
          window.setTimeout(() => setSaved(false), 2000)
        },
      },
    )
  }

  const history = (entries ?? []).filter((entry) => entry.for_date !== today)

  return (
    <>
      <header className="screen__header">
        <h1>{t.journal.title}</h1>
      </header>

      <main className="screen__body" id="main">
        <Card className="stack">
          <Field label={t.journal.moodLabel}>
            <div className="mood-row" role="radiogroup" aria-label={t.journal.moodLabel}>
              {MOOD_EMOJIS.map((emoji, index) => {
                const value = index + 1
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="radio"
                    aria-checked={mood === value}
                    aria-label={t.journal.moods[index]}
                    className={mood === value ? 'is-active' : ''}
                    onClick={() => setMood(value)}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
          </Field>

          <Field label={t.journal.noteLabel} htmlFor="note">
            <TextArea
              id="note"
              placeholder={t.journal.notePlaceholder}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          <Button fullWidth onClick={onSave} disabled={save.isPending}>
            {t.common.save}
          </Button>
          {saved && <Banner tone="success">{t.journal.saved}</Banner>}
        </Card>

        <h2 className="section-title">{t.journal.parentTitle}</h2>
        {isPending ? (
          <Spinner label={t.common.loading} />
        ) : history.length === 0 ? (
          <EmptyState icon="📔" title={t.journal.empty} />
        ) : (
          <ul className="journal-list">
            {history.map((entry) => (
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
