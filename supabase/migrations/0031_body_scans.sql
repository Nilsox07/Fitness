-- Fitness Tracker — Körperfotos & Körperfett-Schätzung
-- Auszuführen im Supabase SQL-Editor (nach 0030_reactions.sql).
-- Ein Eintrag = eine Messung (Foto optional, Körperfett als Bereich).
-- Fotos liegen in einem PRIVATEN Storage-Bucket, Ordner = eigene User-ID.

create table if not exists public.body_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null default current_date,
  photo_path text,
  bf_low numeric,
  bf_high numeric,
  weight_kg numeric,
  confidence text,
  source text not null default 'ai',
  created_at timestamptz not null default now()
);

create index if not exists body_scans_user_date_idx on public.body_scans (user_id, date);

alter table public.body_scans enable row level security;

drop policy if exists "body_scans_all_own" on public.body_scans;
create policy "body_scans_all_own" on public.body_scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Privater Bucket (nicht öffentlich) für die Fotos
insert into storage.buckets (id, name, public)
values ('body-photos', 'body-photos', false)
on conflict (id) do update set public = false;

-- Jeder darf nur in seinem eigenen Ordner „<user-id>/…“ lesen, hochladen, löschen
drop policy if exists "body_photos_select_own" on storage.objects;
create policy "body_photos_select_own" on storage.objects
  for select using (bucket_id = 'body-photos' and name like auth.uid()::text || '/%');

drop policy if exists "body_photos_insert_own" on storage.objects;
create policy "body_photos_insert_own" on storage.objects
  for insert with check (bucket_id = 'body-photos' and name like auth.uid()::text || '/%');

drop policy if exists "body_photos_delete_own" on storage.objects;
create policy "body_photos_delete_own" on storage.objects
  for delete using (bucket_id = 'body-photos' and name like auth.uid()::text || '/%');
