-- Planned backend schema (NOT wired into the app yet; the app currently persists to localStorage).
create table profiles (id uuid primary key references auth.users, display_name text, created_at timestamptz default now());
create table saved_dissections (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users not null, name text not null,
  module text not null default 'upper-limb-right', state jsonb not null, history jsonb not null, updated_at timestamptz default now());
create table study_progress (user_id uuid references auth.users, item_key text, interval_days int, due_at timestamptz, primary key (user_id, item_key));
create table notes (user_id uuid references auth.users, structure_id text, body text, updated_at timestamptz default now(), primary key (user_id, structure_id));
create table structure_content (id text primary key, payload jsonb not null, validation text not null default 'unreviewed', reviewed_by text, reviewed_at timestamptz);
alter table saved_dissections enable row level security; alter table study_progress enable row level security; alter table notes enable row level security;
create policy own_rows on saved_dissections using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on study_progress using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on notes using (user_id = auth.uid()) with check (user_id = auth.uid());
