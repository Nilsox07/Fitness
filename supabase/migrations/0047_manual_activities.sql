-- 0047: Manuell eingetragene Aktivitäten (Radfahren, Volleyball, Schwimmen …) – auch ohne Uhr.
-- Kalorien rechnet die App (MET × Dauer × Gewicht) und speichert sie mit. Läuft gefahrlos mehrfach.

create table if not exists public.manual_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sport text not null,
  minutes integer not null check (minutes between 1 and 1440),
  intensity text not null default 'moderate' check (intensity in ('easy', 'moderate', 'hard')),
  distance_km numeric(6, 2),
  kcal integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists manual_activities_user_date on public.manual_activities (user_id, date);

alter table public.manual_activities enable row level security;

drop policy if exists "manual_activities_own" on public.manual_activities;
create policy "manual_activities_own" on public.manual_activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rechte (seit 30.10.2026 nötig): nur angemeldet und Server, kein anon
grant select, insert, update, delete on public.manual_activities to authenticated;
grant select, insert, update, delete on public.manual_activities to service_role;
