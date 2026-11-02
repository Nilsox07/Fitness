-- Fitness Tracker — gespeicherte Mahlzeiten („Als Mahlzeit speichern“) und Supplement-Vorrat
-- Auszuführen im Supabase SQL-Editor (nach 0041). Mehrfach ausführbar.

-- ---- Gespeicherte Mahlzeiten ------------------------------------------------
-- items: [{ name, amount_g, kcal, protein, carbs, fat, fiber, sugar, sat_fat, salt, barcode, fluid_ml }]
create table if not exists public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  meal text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists saved_meals_user_idx on public.saved_meals (user_id, created_at);

alter table public.saved_meals enable row level security;
drop policy if exists "saved_meals_own" on public.saved_meals;
create policy "saved_meals_own" on public.saved_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---- Supplement-Vorrat (alles optional) ------------------------------------------
-- Rest = stock_amount − dose_amount × Einnahmen seit stock_set_at (aus supplement_log.taken_at).
alter table public.supplements add column if not exists stock_amount numeric check (stock_amount is null or stock_amount >= 0);
alter table public.supplements add column if not exists stock_unit text check (stock_unit is null or stock_unit in ('Stück', 'g', 'ml'));
alter table public.supplements add column if not exists dose_amount numeric check (dose_amount is null or dose_amount > 0);
alter table public.supplements add column if not exists stock_set_at timestamptz;
-- zuletzt gekaufte Packungsgröße (Vorschlag beim Nachfüllen)
alter table public.supplements add column if not exists stock_pack numeric check (stock_pack is null or stock_pack > 0);

create index if not exists supplement_log_user_taken_idx on public.supplement_log (user_id, taken_at);
