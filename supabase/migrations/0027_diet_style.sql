-- Fitness Tracker — Ernährungsweise (Makro-Stil, Einschränkungen, Intervallfasten)
-- Auszuführen im Supabase SQL-Editor (nach 0026_meal_plans.sql). Idempotent.
--
-- Die App funktioniert auch OHNE diese Migration (Auswahl landet dann im
-- localStorage `diet_style_fallback`); nach dem Ausführen wird sie in der DB
-- gespeichert. RLS: bestehende Policy „nutrition_settings_all_own" (0004) gilt
-- auch für die neuen Spalten — nichts weiter zu tun.

alter table public.nutrition_settings
  add column if not exists diet_macro text default 'balanced',
  add column if not exists diet_restrictions text[] default '{}',
  add column if not exists fasting text default 'none',
  add column if not exists fasting_start text default '12:00';

-- Erlaubte Werte (alte Prüfregeln vorher entfernen, damit erneutes Ausführen klappt).
alter table public.nutrition_settings
  drop constraint if exists nutrition_settings_diet_macro_check;
alter table public.nutrition_settings
  add constraint nutrition_settings_diet_macro_check
  check (diet_macro is null or diet_macro in ('balanced', 'high_protein', 'low_carb', 'keto', 'mediterranean'));

alter table public.nutrition_settings
  drop constraint if exists nutrition_settings_diet_restrictions_check;
alter table public.nutrition_settings
  add constraint nutrition_settings_diet_restrictions_check
  check (diet_restrictions is null or diet_restrictions <@ array['vegetarian', 'vegan', 'pescetarian', 'unprocessed']::text[]);

alter table public.nutrition_settings
  drop constraint if exists nutrition_settings_fasting_check;
alter table public.nutrition_settings
  add constraint nutrition_settings_fasting_check
  check (fasting is null or fasting in ('none', '16:8', '18:6', '20:4', '5:2'));

alter table public.nutrition_settings
  drop constraint if exists nutrition_settings_fasting_start_check;
alter table public.nutrition_settings
  add constraint nutrition_settings_fasting_start_check
  check (fasting_start is null or fasting_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
