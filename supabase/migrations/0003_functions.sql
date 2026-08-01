-- Server-side rules that must not depend on the client behaving well.

-- Completions are inserted with only (task_id, for_date, client_id); everything that
-- decides stars or approval is derived here from the task definition.
create function public.set_task_completion_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select id, family_id, child_id, stars_value, requires_approval
    into t
  from public.tasks
  where id = new.task_id;

  if t.id is null then
    raise exception 'unknown task %', new.task_id using errcode = '23503';
  end if;

  new.family_id := t.family_id;
  new.child_id := t.child_id;
  new.stars_awarded := t.stars_value;
  new.status := case when t.requires_approval then 'pending_approval'::public.completion_status
                     else 'done'::public.completion_status end;
  return new;
end;
$$;

create trigger task_completions_defaults
  before insert on public.task_completions
  for each row execute function public.set_task_completion_defaults();

create function public.set_checklist_completion_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  t record;
begin
  select i.task_id, tk.family_id, tk.child_id
    into t
  from public.task_checklist_items i
  join public.tasks tk on tk.id = i.task_id
  where i.id = new.item_id;

  if t.task_id is null then
    raise exception 'unknown checklist item %', new.item_id using errcode = '23503';
  end if;

  new.task_id := t.task_id;
  new.family_id := t.family_id;
  new.child_id := t.child_id;
  return new;
end;
$$;

create trigger checklist_item_completions_defaults
  before insert on public.checklist_item_completions
  for each row execute function public.set_checklist_completion_defaults();

create function public.set_journal_entry_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select family_id into new.family_id from public.children where id = new.child_id;
  if new.family_id is null then
    raise exception 'unknown child %', new.child_id using errcode = '23503';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger journal_entries_defaults
  before insert or update on public.journal_entries
  for each row execute function public.set_journal_entry_defaults();

-- Creating a family and its first profile is a chicken-and-egg problem for RLS:
-- the user has no family yet, so no insert policy can match. Hence one definer RPC.
create function public.create_family(family_name text, display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  new_family_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'user already belongs to a family' using errcode = '23505';
  end if;

  insert into public.families (name)
  values (nullif(btrim(family_name), ''))
  returning id into new_family_id;

  insert into public.profiles (id, family_id, display_name, role)
  values (uid, new_family_id, coalesce(nullif(btrim(display_name), ''), 'הורה'), 'owner');

  return new_family_id;
end;
$$;

grant execute on function public.create_family(text, text) to authenticated;

-- Joining an existing family: the caller has no profile yet, so this too must be a
-- definer function. The plaintext token never reaches the database in stored form.
create function public.accept_invite(invite_code text, invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv record;
  joined_family_id uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = uid) then
    raise exception 'user already belongs to a family' using errcode = '23505';
  end if;

  select * into inv
  from public.invites
  where code = upper(btrim(invite_code))
  for update;

  if inv.id is null
     or inv.revoked_at is not null
     or inv.used_at is not null
     or inv.expires_at < now()
     or inv.token_hash <> encode(sha256(convert_to(invite_token, 'UTF8')), 'hex')
  then
    raise exception 'invalid invite' using errcode = '22023';
  end if;

  insert into public.profiles (id, family_id, display_name, role)
  values (
    uid,
    inv.family_id,
    coalesce(
      nullif(btrim((select raw_user_meta_data ->> 'display_name' from auth.users where id = uid)), ''),
      'הורה'
    ),
    inv.role
  );

  update public.invites
     set used_at = now(), used_by = uid
   where id = inv.id;

  joined_family_id := inv.family_id;
  return joined_family_id;
end;
$$;

grant execute on function public.accept_invite(text, text) to authenticated;

-- Redemption requests validate affordability against the derived balance, so a client
-- cannot spend stars a child has not earned.
create function public.request_redemption(p_child_id uuid, p_reward_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  fam uuid := private.current_family_id();
  r record;
  balance integer;
  new_id uuid;
begin
  if fam is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not exists (select 1 from public.children where id = p_child_id and family_id = fam) then
    raise exception 'child not in family' using errcode = '42501';
  end if;

  select * into r from public.rewards where id = p_reward_id and family_id = fam and is_active;
  if r.id is null then
    raise exception 'unknown reward' using errcode = '22023';
  end if;

  select stars_balance into balance from public.child_star_balances where child_id = p_child_id;

  -- Stars already committed to other pending requests cannot be spent twice.
  balance := balance - coalesce(
    (select sum(star_cost) from public.reward_redemptions
      where child_id = p_child_id and status = 'pending'), 0);

  if balance < r.star_cost then
    raise exception 'not enough stars' using errcode = '22023';
  end if;

  insert into public.reward_redemptions (family_id, reward_id, child_id, reward_title, star_cost)
  values (fam, r.id, p_child_id, r.title, r.star_cost)
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.request_redemption(uuid, uuid) to authenticated;

create function public.approve_completion(p_completion_id uuid, p_approve boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fam uuid := private.current_family_id();
begin
  if fam is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if p_approve then
    update public.task_completions
       set status = 'approved', approved_at = now(), approved_by = (select auth.uid())
     where id = p_completion_id and family_id = fam and status = 'pending_approval';
  else
    delete from public.task_completions
     where id = p_completion_id and family_id = fam and status = 'pending_approval';
  end if;
end;
$$;

grant execute on function public.approve_completion(uuid, boolean) to authenticated;

create function public.resolve_redemption(p_redemption_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  fam uuid := private.current_family_id();
begin
  if fam is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update public.reward_redemptions
     set status = case when p_approve then 'approved'::public.redemption_status
                       else 'rejected'::public.redemption_status end,
         resolved_at = now(),
         resolved_by = (select auth.uid())
   where id = p_redemption_id and family_id = fam and status = 'pending';
end;
$$;

grant execute on function public.resolve_redemption(uuid, boolean) to authenticated;
