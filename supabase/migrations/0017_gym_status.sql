-- Fitness Tracker — „Wann Gym?": Status teilen + Freunde anstupsen
-- Auszuführen im Supabase SQL-Editor (nach 0016_recipes.sql).

-- Freitext-Status „nächstes Training" in den geteilten Statistiken.
alter table public.user_stats
  add column if not exists gym_status text;

-- Anstupser: „Wann gehst du wieder ins Gym?"
create table if not exists public.pokes (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists pokes_to_idx on public.pokes (to_user);

alter table public.pokes enable row level security;

-- Nur an Freunde anstupsen
drop policy if exists "pokes_insert" on public.pokes;
create policy "pokes_insert" on public.pokes
  for insert with check (
    auth.uid() = from_user and exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = to_user
    )
  );

drop policy if exists "pokes_read" on public.pokes;
create policy "pokes_read" on public.pokes
  for select using (auth.uid() = from_user or auth.uid() = to_user);

-- Empfänger darf erledigte Anstupser löschen
drop policy if exists "pokes_delete" on public.pokes;
create policy "pokes_delete" on public.pokes
  for delete using (auth.uid() = to_user);
