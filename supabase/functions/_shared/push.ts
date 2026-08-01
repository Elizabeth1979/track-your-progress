import webpush from 'npm:web-push@3.6.7'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

export type Subscription = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )
}

function configureVapid() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'

  if (!publicKey || !privateKey) {
    throw new Error('VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set as function secrets')
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
}

/**
 * Sends one payload to many subscriptions. Endpoints the push service reports as gone
 * (404/410) are deleted, otherwise the table fills up with dead devices forever.
 */
export async function sendToSubscriptions(
  client: SupabaseClient,
  subscriptions: Subscription[],
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (subscriptions.length === 0) return { sent: 0, removed: 0 }
  configureVapid()

  const body = JSON.stringify(payload)
  const stale: string[] = []
  let sent = 0

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        )
        sent += 1
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) stale.push(subscription.endpoint)
        else console.error('push failed', subscription.endpoint, status, String(error))
      }
    }),
  )

  if (stale.length > 0) {
    await client.from('push_subscriptions').delete().in('endpoint', stale)
  }

  return { sent, removed: stale.length }
}

export async function subscriptionsForFamily(
  client: SupabaseClient,
  familyId: string,
): Promise<Subscription[]> {
  const { data, error } = await client
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('family_id', familyId)
  if (error) throw error
  return (data ?? []) as Subscription[]
}

/** Rejects anything that is not the service role, for database-triggered endpoints. */
export function requireServiceRole(request: Request): boolean {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { role?: string }
    return payload.role === 'service_role'
  } catch {
    return false
  }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
