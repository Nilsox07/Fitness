-- Fitness Tracker — Ernährungsplan: Routinen + gespeicherte Pläne/Einkaufslisten
-- Auszuführen im Supabase SQL-Editor (nach 0025_recomp_water.sql).

-- Feste, wiederkehrende Mahlzeiten (z. B. „jeden Morgen Proteinshake").
create table if not exists public.meal_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal text not null default 'breakfast',
  title text not null,
  kcal int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists meal_routines_user_idx on public.meal_routines (user_id);

alter table public.meal_routines enable row level security;
drop policy if exists "meal_routines_own" on public.meal_routines;
create policy "meal_routines_own" on public.meal_routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Gespeicherte Ernährungspläne inkl. Einkaufsliste (als JSON).
create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  days int not null default 7,
  plan jsonb not null default '[]',
  shopping jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists meal_plans_user_idx on public.meal_plans (user_id);

alter table public.meal_plans enable row level security;
drop policy if exists "meal_plans_own" on public.meal_plans;
create policy "meal_plans_own" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
