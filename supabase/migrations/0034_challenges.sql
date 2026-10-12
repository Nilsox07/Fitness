-- Fitness Tracker — Wochen-Challenges mit Einsatz zwischen Freunden
-- Auszuführen im Supabase SQL-Editor (nach 0033_unlocks_seasons.sql).
-- Beispiel: „Wer diese Woche keine 4 Trainings schafft, gibt einen Kaffee aus.“
-- Jeder trägt seinen eigenen Stand (creator_value / opponent_value) selbst ein.

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator uuid not null references auth.users (id) on delete cascade,
  opponent uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('sessions', 'protein_days', 'logged_days')),
  target int not null check (target between 1 and 7),
  stake text not null check (char_length(stake) between 1 and 60),
  week_start date not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined')),
  creator_value int not null default 0,
  opponent_value int not null default 0,
  created_at timestamptz not null default now(),
  check (creator <> opponent)
);
create index if not exists challenges_creator_idx on public.challenges (creator, week_start);
create index if not exists challenges_opponent_idx on public.challenges (opponent, week_start);

alter table public.challenges enable row level security;

drop policy if exists "challenges_read" on public.challenges;
create policy "challenges_read" on public.challenges
  for select using (auth.uid() = creator or auth.uid() = opponent);

-- Nur mit Freunden
drop policy if exists "challenges_insert" on public.challenges;
create policy "challenges_insert" on public.challenges
  for insert with check (
    auth.uid() = creator
    and exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = opponent)
  );

drop policy if exists "challenges_update" on public.challenges;
create policy "challenges_update" on public.challenges
  for update using (auth.uid() = creator or auth.uid() = opponent);

drop policy if exists "challenges_delete" on public.challenges;
create policy "challenges_delete" on public.challenges
  for delete using (auth.uid() = creator);
