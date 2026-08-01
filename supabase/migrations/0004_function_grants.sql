-- Postgres grants EXECUTE to PUBLIC by default, which exposes every function through
-- PostgREST. Trigger helpers should not be callable at all, and the RPCs only by
-- signed-in users.

revoke execute on function public.set_task_completion_defaults() from public, anon, authenticated;
revoke execute on function public.set_checklist_completion_defaults() from public, anon, authenticated;
revoke execute on function public.set_journal_entry_defaults() from public, anon, authenticated;

revoke execute on function public.create_family(text, text) from public, anon;
revoke execute on function public.accept_invite(text, text) from public, anon;
revoke execute on function public.request_redemption(uuid, uuid) from public, anon;
revoke execute on function public.approve_completion(uuid, boolean) from public, anon;
revoke execute on function public.resolve_redemption(uuid, boolean) from public, anon;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.request_redemption(uuid, uuid) to authenticated;
grant execute on function public.approve_completion(uuid, boolean) to authenticated;
grant execute on function public.resolve_redemption(uuid, boolean) to authenticated;

revoke execute on function private.current_family_id() from public, anon;
