-- A sport set can now be measured either way: seconds for a plank or wall-sit, or a
-- rep count for squats and push-ups. Rest between sets stays timed in both cases.

alter table public.tasks
  add column if not exists reps integer
    check (reps is null or reps between 1 and 500);

-- A sport task needs its set count plus exactly one way of measuring the set.
alter table public.tasks drop constraint if exists tasks_sport_needs_sets;

alter table public.tasks add constraint tasks_sport_needs_sets check (
  type <> 'sport'
  or (
    sets_count is not null
    and (set_seconds is not null) <> (reps is not null)
  )
);
