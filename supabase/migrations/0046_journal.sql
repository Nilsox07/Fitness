-- 0046: Journal – Gewohnheiten des Tages + wie ausgeruht am Morgen (1–5).
-- Ein Eintrag je Tag; die App vergleicht damit Schlaf & Erholung in der Nacht danach.
-- Läuft gefahrlos mehrfach.

create table if not exists public.journal_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  tags text[] not null default '{}',
  feel smallint check (feel between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.journal_entries enable row level security;

drop policy if exists "journal_entries_own" on public.journal_entries;
create policy "journal_entries_own" on public.journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Rechte (seit 30.10.2026 nötig): nur angemeldet und Server, kein anon
grant select, insert, update, delete on public.journal_entries to authenticated;
grant select, insert, update, delete on public.journal_entries to service_role;
