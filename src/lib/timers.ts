import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Countdown state is stored as an absolute end timestamp, never as a decrementing
 * counter. Browsers throttle or freeze timers in background tabs, so on return the UI
 * recomputes from the clock and shows the truth instead of a stalled number.
 */
export type TimerState = {
  endsAt: number | null
  remainingWhenPaused: number | null
  durationSeconds: number
}

const PREFIX = 'kidtasks.timer.'

function load(key: string): TimerState | null {
  const raw = localStorage.getItem(PREFIX + key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TimerState
  } catch {
    return null
  }
}

function save(key: string, state: TimerState | null) {
  if (state) localStorage.setItem(PREFIX + key, JSON.stringify(state))
  else localStorage.removeItem(PREFIX + key)
}

/**
 * Timer keys carry the date they belong to, so yesterday's entries are dead weight —
 * and a stale one whose end time has passed makes today's task open in the "finished"
 * state. Dropping anything that is not for `keepDateKey` keeps both problems away.
 */
export function pruneStaleTimers(keepDateKey: string): void {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const storageKey = localStorage.key(index)
    if (!storageKey?.startsWith(PREFIX)) continue
    if (!storageKey.endsWith(`-${keepDateKey}`)) localStorage.removeItem(storageKey)
  }
}

export type Countdown = {
  remaining: number
  running: boolean
  finished: boolean
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
}

export function useCountdown(
  key: string,
  durationSeconds: number,
  onFinish?: () => void,
): Countdown {
  const [state, setState] = useState<TimerState | null>(() => load(key))
  const [now, setNow] = useState(() => Date.now())
  const finishedRef = useRef(false)

  // Reset bookkeeping when the timer identity changes (e.g. moving to the next set).
  useEffect(() => {
    finishedRef.current = false
    setState(load(key))
  }, [key])

  const remaining = state?.endsAt
    ? Math.max(0, Math.ceil((state.endsAt - now) / 1000))
    : (state?.remainingWhenPaused ?? durationSeconds)

  const running = Boolean(state?.endsAt) && remaining > 0

  // Keyed on `running`, not on endsAt: once the countdown reaches zero endsAt is still
  // set, so an endsAt-keyed interval would keep re-rendering at 4Hz forever.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  // Coming back from a background tab must re-sync immediately, not on the next tick.
  useEffect(() => {
    const onVisible = () => setNow(Date.now())
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])

  const finished = Boolean(state?.endsAt) && remaining === 0

  useEffect(() => {
    if (finished && !finishedRef.current) {
      finishedRef.current = true
      onFinish?.()
    }
  }, [finished, onFinish])

  const start = useCallback(() => {
    finishedRef.current = false
    const next: TimerState = {
      endsAt: Date.now() + durationSeconds * 1000,
      remainingWhenPaused: null,
      durationSeconds,
    }
    save(key, next)
    setState(next)
    setNow(Date.now())
  }, [key, durationSeconds])

  const pause = useCallback(() => {
    setState((current) => {
      if (!current?.endsAt) return current
      const next: TimerState = {
        endsAt: null,
        remainingWhenPaused: Math.max(0, Math.ceil((current.endsAt - Date.now()) / 1000)),
        durationSeconds: current.durationSeconds,
      }
      save(key, next)
      return next
    })
  }, [key])

  const resume = useCallback(() => {
    setState((current) => {
      const seconds = current?.remainingWhenPaused ?? durationSeconds
      const next: TimerState = {
        endsAt: Date.now() + seconds * 1000,
        remainingWhenPaused: null,
        durationSeconds,
      }
      save(key, next)
      return next
    })
    setNow(Date.now())
  }, [key, durationSeconds])

  const reset = useCallback(() => {
    finishedRef.current = false
    save(key, null)
    setState(null)
  }, [key])

  return { remaining, running, finished, start, pause, resume, reset }
}

/** Best-effort screen wake lock while a child watches a countdown. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    void navigator.wakeLock
      .request('screen')
      .then((lock) => {
        if (cancelled) void lock.release()
        else sentinel = lock
      })
      .catch(() => {
        // Denied or unsupported: the timer still works, the screen may just dim.
      })

    return () => {
      cancelled = true
      void sentinel?.release().catch(() => {})
    }
  }, [active])
}

/** A short chime built with the Web Audio API, so no audio asset has to ship. */
export function playChime() {
  try {
    const AudioCtor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    const context = new AudioCtor()
    const gain = context.createGain()
    gain.connect(context.destination)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, context.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8)

    for (const [index, frequency] of [660, 880].entries()) {
      const oscillator = context.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      oscillator.connect(gain)
      oscillator.start(context.currentTime + index * 0.18)
      oscillator.stop(context.currentTime + 0.9)
    }

    window.setTimeout(() => void context.close(), 1200)
  } catch {
    // Audio is a nicety; never let it break a completion.
  }
}

/** Fires a local notification when the tab is alive but not in the foreground. */
export function notifyTimerDone(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (document.visibilityState === 'visible') return
  try {
    void navigator.serviceWorker?.ready.then((registration) =>
      registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        tag: 'kidtasks-timer',
      }),
    )
  } catch {
    // Ignore: the in-app chime already signalled completion.
  }
}
