-- client_id (not scope_key — see lib/notebooks.ts's module comment on the notebook identity
-- redesign) is the app-generated Notebook.id, the same sync-dedup column name bookmarks/highlights
-- already use (lib/supabase/sync.ts). A notebook's scope is optional, fixed-at-creation metadata
-- now, not its identity, so it's no longer part of this table's uniqueness constraint.
create table if not exists user_notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table user_notebooks enable row level security;

-- Access-time gate, not just creation-time: re-checked on every select/insert/update/delete, not
-- only when a notebook is first created. Without this, a user could subscribe, create many
-- notebooks, cancel, and keep using all of them forever with no further check. The oldest
-- notebook (by created_at) always stays free; every other one requires a currently-active
-- subscription. The moment the Stripe webhook (Phase D) flips subscriptions.status away from
-- 'active', every notebook but the original becomes immediately unreadable/unwritable — nothing
-- is deleted, and resubscribing restores access instantly with no data loss.
create policy "user_notebooks_access" on user_notebooks
  for all
  using (
    user_id = auth.uid()
    and (
      id = (select id from user_notebooks n2 where n2.user_id = auth.uid() order by created_at asc limit 1)
      or exists (select 1 from subscriptions s where s.user_id = auth.uid() and s.status = 'active')
    )
  )
  with check (
    user_id = auth.uid()
    and (
      -- Bootstrap case: on INSERT, the row being inserted isn't visible to a subquery within the
      -- same statement, so "select the oldest" can never resolve to the row currently being
      -- created — without this branch, a first-time free user could never create their first
      -- notebook at all. Only relevant while zero rows exist yet for this user.
      not exists (select 1 from user_notebooks n2 where n2.user_id = auth.uid())
      or id = (select id from user_notebooks n2 where n2.user_id = auth.uid() order by created_at asc limit 1)
      or exists (select 1 from subscriptions s where s.user_id = auth.uid() and s.status = 'active')
    )
  );
