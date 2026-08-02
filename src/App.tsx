import { useEffect } from 'react'
import { startOutboxWorker } from './lib/outbox'
import { pruneStaleTimers } from './lib/timers'
import { todayKey } from './lib/dates'
import { AppRoutes } from './routes'
import { OfflineBanner } from './components/OfflineBanner'
import { UpdatePrompt } from './components/UpdatePrompt'
import './App.css'

export function App() {
  useEffect(() => startOutboxWorker(), [])
  // Clears any countdown left over from a previous day, including ones written before
  // timer keys carried a date.
  useEffect(() => pruneStaleTimers(todayKey()), [])

  return (
    <>
      <OfflineBanner />
      <AppRoutes />
      <UpdatePrompt />
    </>
  )
}
