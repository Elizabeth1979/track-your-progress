import {
  jsonResponse,
  requireServiceRole,
  sendToSubscriptions,
  serviceClient,
  subscriptionsForFamily,
} from '../_shared/push.ts'

/**
 * Daily slot reminders, invoked by pg_cron every five minutes.
 *
 * Each family stores its own reminder times and time zone, so "07:30" means 07:30 where
 * the family lives. A family is reminded when the current local time falls inside the
 * five-minute window that starts at one of its configured times, and only if that slot
 * actually has unfinished tasks today.
 */
type ReminderTimes = { morning?: string; afternoon?: string; evening?: string }

const SLOT_LABELS: Record<string, string> = {
  morning: 'משימות הבוקר',
  afternoon: 'משימות הצהריים',
  evening: 'משימות הערב',
}

const WINDOW_MINUTES = 5

function localParts(timezone: string, now: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(now).map((part) => [part.type, part.value]),
  )
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    weekday: weekdays.indexOf(parts.weekday ?? 'Sun'),
  }
}

function parseMinutes(value: string | undefined): number | null {
  if (!value) return null
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null
  return hour * 60 + minute
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)
  if (!requireServiceRole(request)) return jsonResponse({ error: 'forbidden' }, 403)

  const client = serviceClient()
  const now = new Date()

  const { data: families, error } = await client
    .from('families')
    .select('id, timezone, reminder_times, reminders_enabled')
    .eq('reminders_enabled', true)

  if (error) return jsonResponse({ error: error.message }, 500)

  let notified = 0

  for (const family of families ?? []) {
    let local
    try {
      local = localParts(family.timezone || 'Asia/Jerusalem', now)
    } catch {
      local = localParts('Asia/Jerusalem', now)
    }

    const times = (family.reminder_times ?? {}) as ReminderTimes
    const dueSlot = (['morning', 'afternoon', 'evening'] as const).find((slot) => {
      const target = parseMinutes(times[slot])
      if (target === null) return false
      const delta = local.minutes - target
      return delta >= 0 && delta < WINDOW_MINUTES
    })

    if (!dueSlot) continue

    const { data: tasks } = await client
      .from('tasks')
      .select('id, days_of_week')
      .eq('family_id', family.id)
      .eq('time_slot', dueSlot)
      .eq('is_active', true)

    const dueToday = (tasks ?? []).filter((task) =>
      (task.days_of_week as number[]).includes(local.weekday),
    )
    if (dueToday.length === 0) continue

    const { data: completions } = await client
      .from('task_completions')
      .select('task_id')
      .eq('family_id', family.id)
      .eq('for_date', local.dateKey)

    const doneIds = new Set((completions ?? []).map((row) => row.task_id))
    const remaining = dueToday.filter((task) => !doneIds.has(task.id)).length
    if (remaining === 0) continue

    const subscriptions = await subscriptionsForFamily(client, family.id)
    const result = await sendToSubscriptions(client, subscriptions, {
      title: SLOT_LABELS[dueSlot],
      body: `נשארו ${remaining} משימות`,
      url: '/child',
      tag: `kidtasks-reminder-${dueSlot}`,
    })

    notified += result.sent
  }

  return jsonResponse({ notified })
})
