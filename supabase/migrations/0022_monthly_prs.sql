-- Fitness Tracker — Faire Fortschritts-Kennzahl im Leaderboard
-- Auszuführen im Supabase SQL-Editor (nach 0021_feed.sql).

alter table public.user_stats
  add column if not exists monthly_prs int not null default 0;
