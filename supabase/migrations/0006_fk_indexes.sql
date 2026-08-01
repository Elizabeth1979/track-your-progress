-- Covering indexes for foreign keys that are walked during cascade deletes.
-- Deleting a child or a whole family account is a real user-facing feature, and
-- Postgres scans each referencing table to enforce the constraints; without these
-- the scans are sequential.

create index if not exists checklist_item_completions_child_id_idx
  on public.checklist_item_completions (child_id);

create index if not exists reward_redemptions_reward_id_idx
  on public.reward_redemptions (reward_id);

-- Audit columns referencing auth.users. Never filtered on in application queries,
-- but deleting a parent account has to check them.
create index if not exists invites_created_by_idx on public.invites (created_by);
create index if not exists invites_used_by_idx on public.invites (used_by);
create index if not exists reward_redemptions_resolved_by_idx
  on public.reward_redemptions (resolved_by);
create index if not exists task_completions_approved_by_idx
  on public.task_completions (approved_by);
