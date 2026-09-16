-- Fitness Tracker — Mahlzeiten-Gruppen & Wasser-Tracking
-- Auszuführen im Supabase SQL-Editor (nach 0010_body_weight.sql).

-- Mahlzeit-Zuordnung pro Eintrag (breakfast/lunch/dinner/snack), optional.
alter table public.food_entries
  add column if not exists meal text;

-- Wasseraufnahme: ein Eintrag pro Tag (ml), upsert.
create table if not exists public.water_intake (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  ml integer not null default 0 check (ml >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.water_intake enable row level security;

drop policy if exists "water_intake_all_own" on public.water_intake;
create policy "water_intake_all_own" on public.water_intake
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
