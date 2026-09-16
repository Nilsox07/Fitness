-- Fitness Tracker — Wochen-Trainings in den geteilten Statistiken (für Challenges)
-- Auszuführen im Supabase SQL-Editor (nach 0014_user_stats_level.sql).

alter table public.user_stats
  add column if not exists weekly_sessions int not null default 0;
