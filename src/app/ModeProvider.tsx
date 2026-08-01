import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'

/**
 * Which profile the shared device is currently "being". Child mode is a UI state on the
 * parent's session — see `lib/pin.ts` for why it is not a security boundary.
 */
const CHILD_KEY = 'kidtasks.selectedChild'

type ModeContextValue = {
  selectedChildId: string | null
  selectChild: (childId: string | null) => void
}

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(() =>
    localStorage.getItem(CHILD_KEY),
  )

  const selectChild = useCallback((childId: string | null) => {
    setSelectedChildId(childId)
    if (childId) localStorage.setItem(CHILD_KEY, childId)
    else localStorage.removeItem(CHILD_KEY)
  }, [])

  const value = useMemo(() => ({ selectedChildId, selectChild }), [selectedChildId, selectChild])

  return <ModeContext value={value}>{children}</ModeContext>
}

export function useMode(): ModeContextValue {
  const value = use(ModeContext)
  if (!value) throw new Error('useMode must be used inside <ModeProvider>')
  return value
}
