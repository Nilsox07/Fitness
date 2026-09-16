-- Fitness Tracker — Streak-Freeze & Zustand
-- Auszuführen im Supabase SQL-Editor (nach 0019_season.sql).

create table if not exists public.streak_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  freezes int not null default 1,
  frozen_weeks text[] not null default '{}',
  last_award_week text,
  updated_at timestamptz not null default now()
);

alter table public.streak_state enable row level security;
drop policy if exists "streak_state_own" on public.streak_state;
create policy "streak_state_own" on public.streak_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
