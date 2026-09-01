-- Fitness Tracker — Trainingspläne (Routinen)
-- Auszuführen im Supabase SQL-Editor (nach 0006_weight_steps.sql).
-- Ein Plan ist eine benannte, geordnete Liste von Übungen (z. B. „Push", „Pull",
-- „Beine"). Beim Training kann man einen Plan wählen und lädt so nur dessen
-- Übungen — statt in der kompletten Übungsliste zu scrollen.

-- =========================================================================
-- plans — benannte Routine des Nutzers
-- =========================================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists plans_user_idx on public.plans (user_id);

-- =========================================================================
-- plan_exercises — Übungen eines Plans (geordnet)
-- =========================================================================
create table if not exists public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.plans (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, exercise_id)
);
create index if not exists plan_exercises_plan_idx on public.plan_exercises (plan_id);

-- =========================================================================
-- Row Level Security — nur eigene Daten
-- =========================================================================
alter table public.plans          enable row level security;
alter table public.plan_exercises enable row level security;

drop policy if exists "plans_all_own" on public.plans;
create policy "plans_all_own" on public.plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "plan_exercises_all_own" on public.plan_exercises;
create policy "plan_exercises_all_own" on public.plan_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
