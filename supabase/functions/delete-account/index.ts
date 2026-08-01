import { createClient } from 'jsr:@supabase/supabase-js@2'
import { jsonResponse, serviceClient } from '../_shared/push.ts'

/**
 * Real, irreversible deletion of a family and every account attached to it.
 *
 * Deleting the `families` row cascades through every table, and each parent's auth user
 * is removed afterwards so no orphaned login survives. This is the only place the
 * service-role key is used.
 */
Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'method not allowed' }, 405)

  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: 'unauthorized' }, 401)

  // Resolve the caller with their own token, never with the service role.
  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  )

  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return jsonResponse({ error: 'unauthorized' }, 401)

  const admin = serviceClient()

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('family_id')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profileError) return jsonResponse({ error: 'lookup failed' }, 500)

  // No family yet: just remove the lone auth user so signup can be retried cleanly.
  if (!profile) {
    await admin.auth.admin.deleteUser(userData.user.id)
    return jsonResponse({ deleted: 'user' })
  }

  const { data: members, error: membersError } = await admin
    .from('profiles')
    .select('id')
    .eq('family_id', profile.family_id)

  if (membersError) return jsonResponse({ error: 'lookup failed' }, 500)

  const { error: deleteError } = await admin
    .from('families')
    .delete()
    .eq('id', profile.family_id)

  if (deleteError) return jsonResponse({ error: 'delete failed' }, 500)

  for (const member of members ?? []) {
    const { error } = await admin.auth.admin.deleteUser(member.id)
    if (error) console.error('failed to delete auth user', member.id, error.message)
  }

  return jsonResponse({ deleted: 'family', accounts: members?.length ?? 0 })
})
