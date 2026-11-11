-- ANATOMYVERSE backend schema. Run once in the Supabase SQL editor. Row Level Security keeps every user's data private.
-- Server functions use the service-role key (bypasses RLS) ONLY for subscriptions/usage writes.
create table if not exists saved_dissections (
  id text primary key, user_id uuid references auth.users on delete cascade not null, name text not null,
  module text not null default 'upper-limb-right', state jsonb not null, history jsonb not null, updated_at timestamptz default now());
create table if not exists user_state (
  user_id uuid primary key references auth.users on delete cascade, bookmarks jsonb default '[]', notes jsonb default '{}', progress jsonb default '{}', revision jsonb default '{}', updated_at timestamptz default now());
create table if not exists subscriptions (
  user_id uuid primary key references auth.users on delete cascade, status text not null, stripe_customer_id text, stripe_subscription_id text, current_period_end timestamptz, updated_at timestamptz default now());
create table if not exists tutor_usage (user_id uuid references auth.users on delete cascade, day date, count int not null default 0, primary key (user_id, day));
create table if not exists structure_content (id text primary key, payload jsonb not null, validation text not null default 'unreviewed', reviewed_by text, reviewed_at timestamptz);

alter table saved_dissections enable row level security; alter table user_state enable row level security;
alter table subscriptions enable row level security; alter table tutor_usage enable row level security; alter table structure_content enable row level security;
create policy own_dissections on saved_dissections for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_state on user_state for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy read_own_sub on subscriptions for select using (user_id = auth.uid());   -- writes only via service role (Stripe webhook)
create policy read_own_usage on tutor_usage for select using (user_id = auth.uid());   -- writes only via service role
create policy read_content on structure_content for select using (true);
