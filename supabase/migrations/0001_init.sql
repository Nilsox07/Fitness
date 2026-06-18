-- Fitness Tracker — Initiales Schema
-- Auszuführen im Supabase SQL-Editor (Dashboard -> SQL Editor -> New query).
-- Legt Tabellen, Row Level Security (RLS) und Policies an, sodass jeder Nutzer
-- ausschließlich seine eigenen Daten sehen und ändern kann.

-- =========================================================================
-- Muskelgruppen als Enum (erweiterbar)
-- =========================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'muscle_group') then
    create type muscle_group as enum (
      'Brust', 'Rücken', 'Beine', 'Schultern',
      'Bizeps', 'Trizeps', 'Bauch', 'Ganzkörper', 'Sonstige'
    );
  end if;
end$$;

-- =========================================================================
-- profiles — 1:1 zur auth.users
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

-- Bei Registrierung automatisch ein Profil anlegen
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- exercises — Übungskatalog des Nutzers
-- =========================================================================
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  muscle_group muscle_group not null default 'Sonstige',
  notes text,
  target_rep_min int not null default 8 check (target_rep_min > 0),
  target_rep_max int not null default 12 check (target_rep_max >= target_rep_min),
  increment numeric(6, 2) not null default 2.5 check (increment > 0),
  created_at timestamptz not null default now()
);
create index if not exists exercises_user_idx on public.exercises (user_id);

-- =========================================================================
-- workouts — eine Trainingseinheit
-- =========================================================================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  name text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date desc);

-- =========================================================================
-- workout_sets — einzelne Sätze
-- =========================================================================
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  set_number int not null default 1 check (set_number > 0),
  reps int not null check (reps >= 0),
  weight numeric(7, 2) not null default 0 check (weight >= 0),
  created_at timestamptz not null default now()
);
create index if not exists sets_workout_idx on public.workout_sets (workout_id);
create index if not exists sets_user_exercise_idx on public.workout_sets (user_id, exercise_id);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.profiles      enable row level security;
alter table public.exercises     enable row level security;
alter table public.workouts      enable row level security;
alter table public.workout_sets  enable row level security;

-- profiles: nur das eigene Profil
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Generisches Muster für die übrigen Tabellen: user_id = auth.uid()
drop policy if exists "exercises_all_own" on public.exercises;
create policy "exercises_all_own" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workouts_all_own" on public.workouts;
create policy "workouts_all_own" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "sets_all_own" on public.workout_sets;
create policy "sets_all_own" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
