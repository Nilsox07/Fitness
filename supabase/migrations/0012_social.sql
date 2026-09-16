-- Fitness Tracker — Social: Freunde, geteilte Statistiken, Kudos
-- Auszuführen im Supabase SQL-Editor (nach 0011_meals_water.sql).
--
-- Datenschutz-Modell: Freunde sehen NUR aggregierte Kennzahlen (user_stats),
-- niemals einzelne Sätze oder Ernährung. Freundschaft wird per Freundescode
-- geknüpft und ist beidseitig.

-- 1) Freundescode je Profil ------------------------------------------------
alter table public.profiles
  add column if not exists friend_code text unique;

update public.profiles
  set friend_code = upper(substr(md5(random()::text), 1, 6))
  where friend_code is null;

alter table public.profiles
  alter column friend_code set default upper(substr(md5(random()::text), 1, 6));

-- 2) Freundschaften (beidseitig gespeichert) --------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);
alter table public.friendships enable row level security;
drop policy if exists "friendships_own" on public.friendships;
create policy "friendships_own" on public.friendships
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Geteilte Aggregat-Statistiken ------------------------------------------
create table if not exists public.user_stats (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  total_sessions int not null default 0,
  week_streak int not null default 0,
  tonnage bigint not null default 0,
  weekly_volume int not null default 0,
  last_workout date,
  rank_title text,
  updated_at timestamptz not null default now()
);
alter table public.user_stats enable row level security;
drop policy if exists "user_stats_self" on public.user_stats;
create policy "user_stats_self" on public.user_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_stats_friends_read" on public.user_stats;
create policy "user_stats_friends_read" on public.user_stats
  for select using (
    exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = user_stats.user_id
    )
  );

-- 4) Kudos (Applaus zwischen Freunden) --------------------------------------
create table if not exists public.kudos (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.kudos enable row level security;
drop policy if exists "kudos_insert_own" on public.kudos;
create policy "kudos_insert_own" on public.kudos
  for insert with check (auth.uid() = from_user);
drop policy if exists "kudos_read_involved" on public.kudos;
create policy "kudos_read_involved" on public.kudos
  for select using (auth.uid() = from_user or auth.uid() = to_user);

-- 5) Freund hinzufügen per Code (beidseitig) --------------------------------
create or replace function public.add_friend(code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target uuid;
begin
  select id into target from public.profiles where friend_code = upper(code);
  if target is null then raise exception 'Freundescode nicht gefunden'; end if;
  if target = auth.uid() then raise exception 'Das ist dein eigener Code'; end if;
  insert into public.friendships (user_id, friend_id) values (auth.uid(), target)
    on conflict do nothing;
  insert into public.friendships (user_id, friend_id) values (target, auth.uid())
    on conflict do nothing;
end;
$$;
