-- KI-Nutzung pro Nutzer (für Limits pro Minute/Tag in /api/ai).
-- Nur der Server (Service-Role) liest und schreibt; für die App gesperrt.

create table if not exists public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);

create index if not exists ai_calls_user_at on public.ai_calls (user_id, at desc);

alter table public.ai_calls enable row level security;
-- keine Policies: anon/authenticated haben keinen Zugriff

-- Alte Einträge täglich aufräumen (Platz im Free-Tarif sparen)
select cron.schedule(
  'ai-calls-cleanup',
  '17 3 * * *',
  $$ delete from public.ai_calls where at < now() - interval '3 days' $$
);
