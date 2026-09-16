-- Fitness Tracker — Weitere Nährwerte (Ballaststoffe, Zucker, gesätt. Fett, Salz)
-- Auszuführen im Supabase SQL-Editor (nach 0023_nutrition_battle.sql).

alter table public.food_entries
  add column if not exists fiber numeric(7, 1) not null default 0,
  add column if not exists sugar numeric(7, 1) not null default 0,
  add column if not exists sat_fat numeric(7, 1) not null default 0,
  add column if not exists salt numeric(7, 2) not null default 0;

alter table public.recipes
  add column if not exists fiber numeric(7, 1) not null default 0,
  add column if not exists sugar numeric(7, 1) not null default 0,
  add column if not exists sat_fat numeric(7, 1) not null default 0,
  add column if not exists salt numeric(7, 2) not null default 0;
