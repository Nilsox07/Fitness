-- Fitness Tracker — Erinnerungen (Push) einzeln einstellbar
-- Auszuführen im Supabase SQL-Editor (nach 0031_body_scans.sql).
--
-- Teil 1: Protokoll, damit jede Erinnerungsart höchstens einmal pro Tag kommt.
-- Nur der Server (Service-Role) schreibt hier; Nutzer haben keinen Zugriff.

create table if not exists public.notification_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);

alter table public.notification_log enable row level security;

-- Teil 2: Zeitplan. Vercel (kostenloser Tarif) darf Crons nur 1× pro Tag starten,
-- Erinnerungen brauchen aber feste Uhrzeiten. Deshalb ruft Supabase selbst alle
-- 15 Minuten den Erinnerungs-Endpoint auf.
-- DEINE-APP.vercel.app und DEIN-CRON-SECRET ersetzen (CRON_SECRET = gleicher Wert
-- wie in Vercel → Settings → Environment Variables).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('fitness-reminders')
where exists (select 1 from cron.job where jobname = 'fitness-reminders');

select cron.schedule(
  'fitness-reminders',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://DEINE-APP.vercel.app/api/cron/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer DEIN-CRON-SECRET')
  );
  $$
);
