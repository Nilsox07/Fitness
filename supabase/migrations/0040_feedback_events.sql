-- 0040: Feedback aus der App + anonyme Nutzungs-Statistik.
-- Idempotent: kann gefahrlos mehrfach laufen.

-- ---------------------------------------------------------------------------
-- Feedback & Problem melden (Profil → „Feedback & Problem melden“)
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('idea', 'missing', 'problem')),
  text text not null check (char_length(text) between 1 and 4000),
  -- kleines JPEG als Data-URL (≤ ~300 KB), optional
  screenshot text check (screenshot is null or char_length(screenshot) <= 420000),
  -- App-Version, Plattform, Route – keine Gesundheitswerte
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Anonyme Nutzungs-Statistik (pseudonym: user_hash = SHA-256 aus User-ID + App-Salt,
-- im Client berechnet). Nur Funktions-Namen und kleine Merkmale, nie Gesundheitswerte.
-- Lesen nur im SQL-Editor bzw. mit Service-Role (keine Select-Policy).
-- ---------------------------------------------------------------------------
create table if not exists public.app_events (
  id bigserial primary key,
  user_hash text not null check (char_length(user_hash) = 64),
  name text not null check (char_length(name) between 1 and 40),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 1024),
  app_version text check (app_version is null or char_length(app_version) <= 20),
  platform text check (platform is null or char_length(platform) <= 20),
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_idx on public.app_events (created_at);
create index if not exists app_events_name_created_idx on public.app_events (name, created_at);
create index if not exists app_events_user_idx on public.app_events (user_hash);

alter table public.app_events enable row level security;

drop policy if exists "app_events_insert" on public.app_events;
create policy "app_events_insert" on public.app_events
  for insert to authenticated with check (true);

-- Rohdaten nach 13 Monaten löschen (optional, wenn pg_cron aktiv ist – Migration 0032):
-- select cron.schedule('app_events_cleanup', '17 3 * * *',
--   $$delete from public.app_events where created_at < now() - interval '13 months'$$);

-- ---------------------------------------------------------------------------
-- Auswertungen für den SQL-Editor (nur lesen, nicht ausführen nötig):
-- ---------------------------------------------------------------------------
-- Tägliche aktive Nutzer (DAU), letzte 30 Tage:
--   select date_trunc('day', created_at)::date as tag, count(distinct user_hash) as dau
--   from public.app_events
--   where created_at > now() - interval '30 days'
--   group by 1 order by 1;
--
-- Wöchentlich / monatlich aktive Nutzer:
--   select count(distinct user_hash) filter (where created_at > now() - interval '7 days') as wau,
--          count(distinct user_hash) filter (where created_at > now() - interval '30 days') as mau
--   from public.app_events;
--
-- 7- und 30-Tage-Retention je Start-Woche (erster Tag mit Event = Start):
--   with first as (
--     select user_hash, min(created_at)::date as d0 from public.app_events group by 1
--   ), flags as (
--     select f.user_hash, f.d0,
--            bool_or(e.created_at::date between f.d0 + 7 and f.d0 + 13) as d7,
--            bool_or(e.created_at::date between f.d0 + 30 and f.d0 + 36) as d30
--     from first f join public.app_events e using (user_hash)
--     group by 1, 2
--   )
--   select date_trunc('week', d0)::date as kohorte,
--          count(*) as neu,
--          round(100.0 * count(*) filter (where d7) / count(*), 1) as d7_prozent,
--          round(100.0 * count(*) filter (where d30) / count(*), 1) as d30_prozent
--   from flags
--   group by 1 order by 1;
--
-- Funktions-Nutzung der letzten 30 Tage (Ereignisse und Nutzer):
--   select name, count(*) as anzahl, count(distinct user_hash) as nutzer
--   from public.app_events
--   where created_at > now() - interval '30 days'
--   group by 1 order by 2 desc;
--
-- Essen eintragen nach Methode / KI nach Funktion:
--   select name, coalesce(props->>'method', props->>'feature') as art, count(*)
--   from public.app_events
--   where name in ('food_logged', 'ai_used') and created_at > now() - interval '30 days'
--   group by 1, 2 order by 3 desc;
--
-- Neues Feedback:
--   select created_at, kind, text, meta from public.feedback order by created_at desc limit 50;
