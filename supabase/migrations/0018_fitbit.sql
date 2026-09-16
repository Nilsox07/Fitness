-- Fitness Tracker — Fitbit-Anbindung (pro Nutzer)
-- Auszuführen im Supabase SQL-Editor (nach 0017_gym_status.sql).
--
-- Die OAuth-Tokens sind sensibel und werden AUSSCHLIESSLICH serverseitig
-- (Service-Role in den /api/fitbit-Funktionen) gelesen/geschrieben. RLS ist
-- aktiv, aber es gibt bewusst KEINE Client-Policy → die App selbst kommt nicht
-- an die Tokens.

create table if not exists public.fitbit_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.fitbit_tokens enable row level security;
-- Keine Policies: nur die Service-Role (Serverless-Funktionen) hat Zugriff.
