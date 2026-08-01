import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { he, type Dictionary } from './he'
import { en } from './en'

export type Locale = 'he' | 'en'

const dictionaries: Record<Locale, Dictionary> = { he, en }
const STORAGE_KEY = 'kidtasks.locale'

type LocaleContextValue = {
  locale: Locale
  dir: 'rtl' | 'ltr'
  t: Dictionary
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

function readStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'he' || stored === 'en') return stored
  return navigator.language.startsWith('he') ? 'he' : 'he'
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale)

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [])

  const dir = dictionaries[locale].meta.dir

  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = dir
  }, [locale, dir])

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir, t: dictionaries[locale], setLocale }),
    [locale, dir, setLocale],
  )

  return <LocaleContext value={value}>{children}</LocaleContext>
}

export function useLocale(): LocaleContextValue {
  const value = use(LocaleContext)
  if (!value) throw new Error('useLocale must be used inside <LocaleProvider>')
  return value
}

/** Shorthand for the common case of only needing the dictionary. */
export function useT(): Dictionary {
  return useLocale().t
}
