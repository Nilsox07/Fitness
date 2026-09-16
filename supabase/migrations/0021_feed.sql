-- Fitness Tracker — Aktivitäts-Feed mit Kommentaren & Likes
-- Auszuführen im Supabase SQL-Editor (nach 0020_streak.sql).
-- Freunde sehen Aktivitäten (Workouts/PRs), können liken und kommentieren.

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text,
  kind text not null default 'workout',
  title text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists activities_created_idx on public.activities (created_at desc);

create table if not exists public.activity_comments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_likes (
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (activity_id, user_id)
);

alter table public.activities enable row level security;
alter table public.activity_comments enable row level security;
alter table public.activity_likes enable row level security;

-- Sichtbarkeit: eigene + Aktivitäten von Freunden
create or replace function public.can_see_activity(a_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.activities a
    where a.id = a_id and (
      a.user_id = auth.uid()
      or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = a.user_id)
    )
  );
$$;

drop policy if exists "activities_read" on public.activities;
create policy "activities_read" on public.activities
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = activities.user_id)
  );
drop policy if exists "activities_insert" on public.activities;
create policy "activities_insert" on public.activities
  for insert with check (user_id = auth.uid());
drop policy if exists "activities_delete" on public.activities;
create policy "activities_delete" on public.activities
  for delete using (user_id = auth.uid());

drop policy if exists "comments_read" on public.activity_comments;
create policy "comments_read" on public.activity_comments
  for select using (public.can_see_activity(activity_id));
drop policy if exists "comments_insert" on public.activity_comments;
create policy "comments_insert" on public.activity_comments
  for insert with check (user_id = auth.uid() and public.can_see_activity(activity_id));

drop policy if exists "likes_read" on public.activity_likes;
create policy "likes_read" on public.activity_likes
  for select using (public.can_see_activity(activity_id));
drop policy if exists "likes_write" on public.activity_likes;
create policy "likes_write" on public.activity_likes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.can_see_activity(activity_id));
