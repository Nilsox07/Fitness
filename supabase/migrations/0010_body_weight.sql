-- Fitness Tracker — Körpergewicht-Tracking
-- Auszuführen im Supabase SQL-Editor (nach 0009_secondary_muscles.sql).
-- Ein Eintrag pro Tag (upsert). Basis für Gewichtskurve und dynamische Ziele.

create table if not exists public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric(6, 2) not null check (weight_kg > 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index if not exists body_weights_user_date_idx on public.body_weights (user_id, date);

alter table public.body_weights enable row level security;

drop policy if exists "body_weights_all_own" on public.body_weights;
create policy "body_weights_all_own" on public.body_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
