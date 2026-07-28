-- Phase B: cross-device sync for bookmarks and highlights.
-- Run manually in the Supabase SQL editor (project zewdazoijdpakugfvnzt) — no service-role/DDL
-- credential is available to this codebase to run migrations programmatically, same as the
-- existing dedication-app-targeting migration in the sibling AnyDaf repo.
--
-- Each row stores the exact local TypeScript shape (Bookmark / Highlight, see lib/bookmarks.ts /
-- lib/highlights.ts) as a jsonb blob rather than a normalized schema, so the sync layer is just
-- "upload/download the object as-is" — see AnyTorahWeb's accounts/sync plan for the rationale.

create table if not exists user_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null, -- the local Bookmark.id, for merge de-dupe across devices
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

create table if not exists user_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  client_id text not null, -- the local Highlight.id
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);

alter table user_bookmarks enable row level security;
alter table user_highlights enable row level security;

create policy "user_bookmarks_owner" on user_bookmarks
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "user_highlights_owner" on user_highlights
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
