-- One row per user. Populated/kept in sync by the Stripe webhook (app/api/stripe/webhook/route.ts,
-- Phase D) via a service-role client — no user-facing RLS write path is needed, only read-your-own.
create table if not exists subscriptions (
  user_id uuid primary key references auth.users on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'none', -- active | trialing | past_due | canceled | none
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table subscriptions enable row level security;

create policy "subscriptions_read_own" on subscriptions
  for select
  using (user_id = auth.uid());
