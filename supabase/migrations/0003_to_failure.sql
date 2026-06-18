-- Fitness Tracker — Marker "bis zum Versagen"
-- Optionaler Marker pro Satz: wurde der Satz bis zum Muskelversagen ausgeführt?
-- Standard: false (du hattest noch Reserve). Verfälscht die Wdh-Zahl nicht.
-- Auszuführen im Supabase SQL-Editor (nach 0002_set_types.sql).

alter table public.workout_sets
  add column if not exists to_failure boolean not null default false;
