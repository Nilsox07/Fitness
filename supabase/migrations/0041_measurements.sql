-- Körpermaße (Taille, Brust, Oberarm, Hüfte, Oberschenkel) in cm – je Tag eine Zeile,
-- jedes Maß optional. Nur für den Nutzer selbst lesbar. Idempotent.

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  waist numeric(5,1) check (waist is null or waist between 10 and 250),
  chest numeric(5,1) check (chest is null or chest between 10 and 250),
  arm numeric(5,1) check (arm is null or arm between 10 and 250),
  hip numeric(5,1) check (hip is null or hip between 10 and 250),
  thigh numeric(5,1) check (thigh is null or thigh between 10 and 250),
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.body_measurements enable row level security;

drop policy if exists "body_measurements_own" on public.body_measurements;
create policy "body_measurements_own" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
