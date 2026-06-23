-- Fitness Tracker — Ernährungstracker
-- Auszuführen im Supabase SQL-Editor (nach 0003_to_failure.sql).
-- Legt Tabellen für Kalorienziel-Einstellungen und Essens-Einträge an (mit RLS).

-- =========================================================================
-- nutrition_settings — Eingaben fürs Kalorienziel + berechnete Zielwerte
-- =========================================================================
create table if not exists public.nutrition_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sex text not null default 'm' check (sex in ('m', 'f')),
  age int not null default 30 check (age between 10 and 100),
  height_cm numeric(5, 1) not null default 175 check (height_cm > 0),
  weight_kg numeric(5, 1) not null default 75 check (weight_kg > 0),
  activity text not null default 'moderate'
    check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain')),
  kcal_target int not null default 0,
  protein_target int not null default 0,
  carbs_target int not null default 0,
  fat_target int not null default 0,
  updated_at timestamptz not null default now()
);

-- =========================================================================
-- food_entries — geloggte Lebensmittel pro Tag (Werte für die gegessene Menge)
-- =========================================================================
create table if not exists public.food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  name text not null,
  amount_g numeric(7, 1),
  kcal numeric(7, 1) not null default 0 check (kcal >= 0),
  protein numeric(6, 1) not null default 0 check (protein >= 0),
  carbs numeric(6, 1) not null default 0 check (carbs >= 0),
  fat numeric(6, 1) not null default 0 check (fat >= 0),
  barcode text,
  created_at timestamptz not null default now()
);
create index if not exists food_entries_user_date_idx
  on public.food_entries (user_id, date desc);

-- =========================================================================
-- Row Level Security
-- =========================================================================
alter table public.nutrition_settings enable row level security;
alter table public.food_entries enable row level security;

drop policy if exists "nutrition_settings_all_own" on public.nutrition_settings;
create policy "nutrition_settings_all_own" on public.nutrition_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "food_entries_all_own" on public.food_entries;
create policy "food_entries_all_own" on public.food_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
