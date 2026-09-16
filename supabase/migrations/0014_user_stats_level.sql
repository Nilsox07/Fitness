-- Fitness Tracker — Level/XP in den geteilten Statistiken (fürs Freunde-Leaderboard)
-- Auszuführen im Supabase SQL-Editor (nach 0013_push.sql).

alter table public.user_stats
  add column if not exists level int not null default 1;
alter table public.user_stats
  add column if not exists xp bigint not null default 0;
