-- Fitness Tracker — Season-XP im Freunde-Leaderboard
-- Auszuführen im Supabase SQL-Editor (nach 0018_fitbit.sql).

alter table public.user_stats
  add column if not exists season_id text;
alter table public.user_stats
  add column if not exists season_xp int not null default 0;
