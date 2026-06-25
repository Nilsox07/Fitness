-- Fitness Tracker — Gewichts-Leiter pro Übung
-- Auszuführen im Supabase SQL-Editor (nach 0005_unilateral.sql).
-- Optionale Liste der real wählbaren Gewichte (für Geräte mit ungleichmäßigem Stack).
-- Leer = gleichmäßige Schritte über "increment".

alter table public.exercises
  add column if not exists weight_steps text;
