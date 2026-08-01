-- Database-side plumbing for Web Push: triggers that fan out family events, plus the
-- scheduled reminder sweep.
--
-- MANUAL STEP: the service-role key is never committed. Before notifications work, run
-- once in the SQL editor (see docs/push-setup.md):
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select cron.schedule('kidtasks-reminders', '*/5 * * * *',
--     $$ select private.call_edge_function('send-reminders', '{}'::jsonb) $$);

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Posts to an Edge Function with the service-role key pulled from Vault. Returns
-- immediately: pg_net is asynchronous, so a slow push never blocks the writing statement.
create function private.call_edge_function(function_name text, body jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_url text;
  service_key text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  -- Missing secrets simply mean push is not configured yet; writes must still succeed.
  if base_url is null or service_key is null then
    return;
  end if;

  perform extensions.net_http_post(
    url := base_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := body,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function private.call_edge_function(text, jsonb) from public, anon, authenticated;

create function public.notify_completion_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  child_name text;
  task_title text;
begin
  select c.name, t.title into child_name, task_title
  from public.tasks t
  join public.children c on c.id = t.child_id
  where t.id = new.task_id;

  if tg_op = 'INSERT' and new.status = 'pending_approval' then
    perform private.call_edge_function('notify-events', jsonb_build_object(
      'event', 'completion_pending',
      'family_id', new.family_id,
      'child_name', child_name,
      'title', task_title
    ));
  elsif tg_op = 'UPDATE' and new.status = 'approved' and old.status <> 'approved' then
    perform private.call_edge_function('notify-events', jsonb_build_object(
      'event', 'completion_approved',
      'family_id', new.family_id,
      'child_name', child_name,
      'title', task_title
    ));
  end if;

  return new;
end;
$$;

create trigger task_completions_notify
  after insert or update on public.task_completions
  for each row execute function public.notify_completion_event();

create function public.notify_redemption_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  child_name text;
begin
  select name into child_name from public.children where id = new.child_id;

  perform private.call_edge_function('notify-events', jsonb_build_object(
    'event', 'redemption_requested',
    'family_id', new.family_id,
    'child_name', child_name,
    'title', new.reward_title
  ));

  return new;
end;
$$;

create trigger reward_redemptions_notify
  after insert on public.reward_redemptions
  for each row execute function public.notify_redemption_event();

create function public.notify_task_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  child_name text;
begin
  select name into child_name from public.children where id = new.child_id;

  perform private.call_edge_function('notify-events', jsonb_build_object(
    'event', 'task_created',
    'family_id', new.family_id,
    'child_name', child_name,
    'title', new.title
  ));

  return new;
end;
$$;

create trigger tasks_notify_created
  after insert on public.tasks
  for each row execute function public.notify_task_created();

revoke execute on function public.notify_completion_event() from public, anon, authenticated;
revoke execute on function public.notify_redemption_event() from public, anon, authenticated;
revoke execute on function public.notify_task_created() from public, anon, authenticated;
