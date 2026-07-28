create table if not exists user_preferences (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "user_preferences_owner" on user_preferences
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
