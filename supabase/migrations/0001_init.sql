-- KidTasks core schema.
-- Every family-scoped table carries `family_id` so a single RLS predicate covers them all.

create type public.task_type as enum ('check', 'checklist', 'timer', 'sport');
create type public.time_slot as enum ('morning', 'afternoon', 'evening');
create type public.completion_status as enum ('done', 'pending_approval', 'approved');
create type public.redemption_status as enum ('pending', 'approved', 'rejected');
create type public.member_role as enum ('owner', 'parent');

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  parent_pin_hash text,
  reminder_times jsonb not null default
    '{"morning": "07:30", "afternoon": "15:30", "evening": "19:00"}'::jsonb,
  reminders_enabled boolean not null default true,
  notify_generic_lockscreen boolean not null default true,
  timezone text not null default 'Asia/Jerusalem',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  family_id uuid not null references public.families (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  role public.member_role not null default 'parent',
  created_at timestamptz not null default now()
);
create index profiles_family_id_idx on public.profiles (family_id);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  avatar_emoji text not null default '🙂' check (length(avatar_emoji) <= 8),
  avatar_color text not null default '#6d5ae0' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index children_family_id_idx on public.children (family_id, sort_order);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  icon text not null default '🗓️' check (length(icon) <= 8),
  time_slot public.time_slot not null default 'evening',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index routines_child_id_idx on public.routines (child_id, sort_order);
create index routines_family_id_idx on public.routines (family_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 80),
  description text check (length(description) <= 400),
  icon text not null default '✅' check (length(icon) <= 8),
  type public.task_type not null default 'check',
  time_slot public.time_slot not null default 'morning',
  -- JS getDay() convention: 0 = Sunday, matching the Israeli week.
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}',
  timer_seconds integer check (timer_seconds is null or timer_seconds between 5 and 7200),
  sets_count integer check (sets_count is null or sets_count between 1 and 50),
  set_seconds integer check (set_seconds is null or set_seconds between 5 and 3600),
  rest_seconds integer check (rest_seconds is null or rest_seconds between 0 and 1800),
  stars_value integer not null default 1 check (stars_value between 0 and 20),
  requires_approval boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint tasks_days_of_week_valid check (
    array_length(days_of_week, 1) between 1 and 7
    and days_of_week <@ '{0,1,2,3,4,5,6}'::smallint[]
  ),
  constraint tasks_timer_needs_duration check (type <> 'timer' or timer_seconds is not null),
  constraint tasks_sport_needs_sets check (
    type <> 'sport' or (sets_count is not null and set_seconds is not null)
  )
);
create index tasks_child_id_idx on public.tasks (child_id, is_active);
create index tasks_family_id_idx on public.tasks (family_id);
create index tasks_routine_id_idx on public.tasks (routine_id, sort_order);

create table public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  sort_order integer not null default 0
);
create index task_checklist_items_task_id_idx on public.task_checklist_items (task_id, sort_order);
create index task_checklist_items_family_id_idx on public.task_checklist_items (family_id);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  for_date date not null,
  status public.completion_status not null default 'done',
  stars_awarded integer not null default 0 check (stars_awarded >= 0),
  -- Client-generated so an offline queue replay is idempotent.
  client_id uuid not null default gen_random_uuid(),
  completed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  unique (task_id, for_date)
);
create index task_completions_child_date_idx on public.task_completions (child_id, for_date);
create index task_completions_family_date_idx on public.task_completions (family_id, for_date);
create index task_completions_pending_idx on public.task_completions (family_id)
  where status = 'pending_approval';

create table public.checklist_item_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  item_id uuid not null references public.task_checklist_items (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  for_date date not null,
  completed_at timestamptz not null default now(),
  unique (item_id, for_date)
);
create index checklist_item_completions_task_date_idx
  on public.checklist_item_completions (task_id, for_date);
create index checklist_item_completions_family_idx on public.checklist_item_completions (family_id);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 80),
  icon text not null default '🎁' check (length(icon) <= 8),
  star_cost integer not null check (star_cost between 1 and 10000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index rewards_family_id_idx on public.rewards (family_id, sort_order);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  reward_id uuid references public.rewards (id) on delete set null,
  child_id uuid not null references public.children (id) on delete cascade,
  reward_title text not null,
  star_cost integer not null check (star_cost >= 0),
  status public.redemption_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null
);
create index reward_redemptions_child_idx on public.reward_redemptions (child_id, status);
create index reward_redemptions_family_idx on public.reward_redemptions (family_id, status);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  for_date date not null,
  mood smallint check (mood between 1 and 5),
  note text check (length(note) <= 2000),
  updated_at timestamptz not null default now(),
  unique (child_id, for_date)
);
create index journal_entries_child_date_idx on public.journal_entries (child_id, for_date desc);
create index journal_entries_family_idx on public.journal_entries (family_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  code text not null unique,
  token_hash text not null,
  role public.member_role not null default 'parent',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  used_by uuid references auth.users (id) on delete set null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index invites_family_idx on public.invites (family_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_subscriptions_family_idx on public.push_subscriptions (family_id);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Star balance is always derived, never a stored counter that can drift.
create view public.child_star_balances
with (security_invoker = true) as
select
  c.id as child_id,
  c.family_id,
  coalesce(earned.stars, 0) as stars_earned,
  coalesce(spent.stars, 0) as stars_spent,
  coalesce(earned.stars, 0) - coalesce(spent.stars, 0) as stars_balance
from public.children c
left join lateral (
  select sum(tc.stars_awarded)::integer as stars
  from public.task_completions tc
  where tc.child_id = c.id and tc.status <> 'pending_approval'
) earned on true
left join lateral (
  select sum(rr.star_cost)::integer as stars
  from public.reward_redemptions rr
  where rr.child_id = c.id and rr.status = 'approved'
) spent on true;
