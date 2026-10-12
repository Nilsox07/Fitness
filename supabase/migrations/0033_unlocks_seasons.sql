-- Fitness Tracker — Outfits für Freunde sichtbar + KI-Saison-Themen
-- Auszuführen im Supabase SQL-Editor (nach 0032_notifications.sql).

-- Geteiltes Buddy-Outfit (Skin, Variante, Accessoire, Rahmen, Titel) – Freunde
-- sehen es in der Community. Die bestehenden user_stats-Regeln gelten weiter.
alter table public.user_stats
  add column if not exists look jsonb;

-- Saison-Thema pro Monat (von der KI erfunden, für alle gleich). Schreiben nur
-- der Server (Service-Role); lesen darf jeder angemeldete Nutzer.
create table if not exists public.season_themes (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.season_themes enable row level security;

drop policy if exists "season_themes_read" on public.season_themes;
create policy "season_themes_read" on public.season_themes
  for select to authenticated using (true);
