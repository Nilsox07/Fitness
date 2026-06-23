-- Fitness Tracker — Einseitige (unilaterale) Übungen
-- Auszuführen im Supabase SQL-Editor (nach 0004_nutrition.sql).
-- Macht Übungen optional einseitig (links/rechts getrennt) erfassbar.

-- Übung kann als einseitig markiert werden
alter table public.exercises
  add column if not exists unilateral boolean not null default false;

-- Werte für die rechte Seite (links bleibt in reps/weight). null bei normalen Sätzen.
alter table public.workout_sets
  add column if not exists reps_right int check (reps_right is null or reps_right >= 0);
alter table public.workout_sets
  add column if not exists weight_right numeric(7, 2) check (weight_right is null or weight_right >= 0);
