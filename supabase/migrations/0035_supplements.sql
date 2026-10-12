-- Fitness Tracker — Supplemente mit Einnahme-Plan und Erinnerung
-- Auszuführen im Supabase SQL-Editor (nach 0034_challenges.sql).

create table if not exists public.supplements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  dose text not null default '' check (char_length(dose) <= 30),
  -- lokale Uhrzeiten „HH:MM“, z. B. {08:00,20:00}
  times text[] not null default '{08:00}',
  -- Wochentage 0 = Mo … 6 = So
  days int[] not null default '{0,1,2,3,4,5,6}',
  remind boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists supplements_user_idx on public.supplements (user_id);

alter table public.supplements enable row level security;
drop policy if exists "supplements_own" on public.supplements;
create policy "supplements_own" on public.supplements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Abgehakte Einnahmen (eine Zeile pro Supplement, Tag und Uhrzeit)
create table if not exists public.supplement_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  supplement_id uuid not null references public.supplements (id) on delete cascade,
  date date not null,
  slot text not null,
  taken_at timestamptz not null default now(),
  primary key (supplement_id, date, slot)
);
create index if not exists supplement_log_user_date_idx on public.supplement_log (user_id, date);

alter table public.supplement_log enable row level security;
drop policy if exists "supplement_log_own" on public.supplement_log;
create policy "supplement_log_own" on public.supplement_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
