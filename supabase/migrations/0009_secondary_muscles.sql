-- Fitness Tracker — Sekundärmuskeln pro Übung
-- Auszuführen im Supabase SQL-Editor (nach 0008_muscle_groups.sql).
--
-- Eine Übung trainiert oft mehrere Muskeln: primär (muscle_group) + sekundär.
-- Beispiel: Breites Rudern → primär Rücken, sekundär Schultern + Bizeps. Das
-- macht die Aufwärm-Logik und die Muskelgruppen-Balance in der Auswertung
-- deutlich genauer.

alter table public.exercises
  add column if not exists secondary_muscles muscle_group[] not null default '{}';
