-- Fitness Tracker — Rezepte speichern & mit Freunden teilen
-- Auszuführen im Supabase SQL-Editor (nach 0015_weekly_sessions.sql).

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text,
  title text not null,
  servings int not null default 1,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  kcal int not null default 0,
  protein int not null default 0,
  carbs int not null default 0,
  fat int not null default 0,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists recipes_user_idx on public.recipes (user_id);

alter table public.recipes enable row level security;

-- Eigene Rezepte: volle Kontrolle
drop policy if exists "recipes_own" on public.recipes;
create policy "recipes_own" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Freunde dürfen geteilte Rezepte lesen
drop policy if exists "recipes_friends_read" on public.recipes;
create policy "recipes_friends_read" on public.recipes
  for select using (
    shared and exists (
      select 1 from public.friendships f
      where f.user_id = auth.uid() and f.friend_id = recipes.user_id
    )
  );
