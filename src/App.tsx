import { useEffect } from 'react'
import { startOutboxWorker } from './lib/outbox'
import { AppRoutes } from './routes'
import { OfflineBanner } from './components/OfflineBanner'
import { UpdatePrompt } from './components/UpdatePrompt'
import './App.css'

export function App() {
  useEffect(() => startOutboxWorker(), [])

  return (
    <>
      <OfflineBanner />
      <AppRoutes />
      <UpdatePrompt />
    </>
  )
}
