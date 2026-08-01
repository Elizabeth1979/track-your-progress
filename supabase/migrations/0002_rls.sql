-- Row level security: one family sees exactly its own rows and nothing else.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- SECURITY DEFINER so the lookup itself bypasses RLS; without it the `profiles`
-- policy would recurse into the very table it is protecting.
create function private.current_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select family_id from public.profiles where id = (select auth.uid())
$$;

grant execute on function private.current_family_id() to authenticated;

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.routines enable row level security;
alter table public.tasks enable row level security;
alter table public.task_checklist_items enable row level security;
alter table public.task_completions enable row level security;
alter table public.checklist_item_completions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.invites enable row level security;
alter table public.push_subscriptions enable row level security;

-- Families: readable and editable by their own members. Rows are only ever created by
-- create_family() and only ever deleted by the delete-account Edge Function.
create policy families_select on public.families
  for select to authenticated
  using (id = private.current_family_id());

create policy families_update on public.families
  for update to authenticated
  using (id = private.current_family_id())
  with check (id = private.current_family_id());

-- Profiles: a parent sees everyone in their family but only edits their own row.
-- Inserts happen exclusively through create_family() / accept_invite().
create policy profiles_select on public.profiles
  for select to authenticated
  using (family_id = private.current_family_id());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and family_id = private.current_family_id());

-- Everything else is plain family scoping.
create policy children_all on public.children
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy routines_all on public.routines
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy tasks_all on public.tasks
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy task_checklist_items_all on public.task_checklist_items
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy task_completions_all on public.task_completions
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy checklist_item_completions_all on public.checklist_item_completions
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy rewards_all on public.rewards
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy reward_redemptions_all on public.reward_redemptions
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

create policy journal_entries_all on public.journal_entries
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id());

-- Invites: family members manage them. Redeeming one goes through accept_invite(),
-- because the joining user has no family yet and so matches no policy here.
create policy invites_all on public.invites
  for all to authenticated
  using (family_id = private.current_family_id())
  with check (family_id = private.current_family_id() and created_by = (select auth.uid()));

-- Push subscriptions belong to a device/user; a parent only writes their own.
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated
  using (family_id = private.current_family_id());

create policy push_subscriptions_write on public.push_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()) and family_id = private.current_family_id());

create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));
