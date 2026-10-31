-- Zyklus (optionaler Bereich): Perioden und Tages-Symptome.
-- Gesundheitsdaten nach DSGVO Art. 9 – strikt nur für die Nutzerin selbst lesbar,
-- nie in Community-Ansichten. Löschen: alle Zeilen der Nutzerin (Knopf in der App).

-- Teil 1: Perioden (manuell oder aus Health Connect)
create table if not exists public.cycle_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  source text not null default 'manual' check (source in ('manual', 'health')),
  created_at timestamptz not null default now(),
  unique (user_id, start_date)
);

alter table public.cycle_periods enable row level security;

drop policy if exists "cycle_periods_own" on public.cycle_periods;
create policy "cycle_periods_own" on public.cycle_periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Teil 2: Symptome je Tag (optional)
create table if not exists public.cycle_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  symptoms text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.cycle_logs enable row level security;

drop policy if exists "cycle_logs_own" on public.cycle_logs;
create policy "cycle_logs_own" on public.cycle_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
