-- Fitness Tracker — Body Recomposition als Ziel + Trinkziel
-- Auszuführen im Supabase SQL-Editor (nach 0024_micros.sql).
--
-- 1) Neues Ziel „recomp" (Body Recomposition) erlauben.
-- 2) Persönliches Trinkziel (ml/Tag) speichern.

-- Alte Prüfregel des Ziels ersetzen, damit auch 'recomp' erlaubt ist.
alter table public.nutrition_settings
  drop constraint if exists nutrition_settings_goal_check;
alter table public.nutrition_settings
  add constraint nutrition_settings_goal_check
  check (goal in ('lose', 'maintain', 'gain', 'recomp'));

-- Trinkziel pro Tag (Default 2500 ml).
alter table public.nutrition_settings
  add column if not exists water_target_ml int not null default 2500
  check (water_target_ml >= 0);
