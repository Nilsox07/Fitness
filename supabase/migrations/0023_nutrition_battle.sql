-- Fitness Tracker — Ernährungs-Battle + Necken
-- Auszuführen im Supabase SQL-Editor (nach 0022_monthly_prs.sql).

-- Aggregierte Nährwerte in den geteilten Statistiken (keine einzelnen Lebensmittel).
alter table public.user_stats
  add column if not exists protein_today int not null default 0;
alter table public.user_stats
  add column if not exists kcal_today int not null default 0;
alter table public.user_stats
  add column if not exists protein_week int not null default 0;

-- Anstupser können jetzt einen Text tragen (z. B. eine Necken-Nachricht).
alter table public.pokes
  add column if not exists text text;
