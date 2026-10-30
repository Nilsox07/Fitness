-- Daten von Smartwatch/Health Connect (nur Zusammenfassungen, keine Rohdaten –
-- spart Platz im Free-Tarif). Die Android-App liest Health Connect und schreibt hierher.

-- Aktivitäten (Laufen, Rad, Schwimmen, …) – eine Zeile pro Einheit
create table if not exists public.health_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source_id text not null,              -- ID aus Health Connect (verhindert Doppelte)
  source text,                          -- App/Uhr, z. B. „Samsung Health“
  type text not null,                   -- run | ride | walk | hike | swim | row | other
  title text,
  started_at timestamptz not null,
  duration_s integer not null check (duration_s >= 0),
  distance_m real,
  kcal real,
  avg_hr smallint,
  max_hr smallint,
  elevation_m real,
  route jsonb,                          -- vereinfachte Strecke [[lat, lng], …] (max. ~200 Punkte)
  created_at timestamptz not null default now(),
  unique (user_id, source_id)
);
create index if not exists health_activities_user_time on public.health_activities (user_id, started_at desc);

-- Schlaf – eine Zeile pro Nacht (date = Aufwach-Tag)
create table if not exists public.health_sleep (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  asleep_min integer not null,
  deep_min integer,
  rem_min integer,
  light_min integer,
  awake_min integer,
  source text,
  primary key (user_id, date)
);

-- Tageswerte
create table if not exists public.health_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  steps integer,
  active_kcal real,
  resting_hr smallint,
  hrv_ms real,
  vo2max real,
  primary key (user_id, date)
);

alter table public.health_activities enable row level security;
alter table public.health_sleep enable row level security;
alter table public.health_daily enable row level security;

create policy "own health_activities" on public.health_activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own health_sleep" on public.health_sleep
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own health_daily" on public.health_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
