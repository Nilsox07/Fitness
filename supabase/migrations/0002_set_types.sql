-- Fitness Tracker — Satz-Typen
-- Fügt jedem Satz einen Typ hinzu: Aufwärm-, Arbeits- oder Dropsatz.
-- Auszuführen im Supabase SQL-Editor (nach 0001_init.sql).
-- Kann gefahrlos mehrfach ausgeführt werden.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'set_type') then
    create type set_type as enum ('warmup', 'working', 'drop');
  end if;
end$$;

alter table public.workout_sets
  add column if not exists set_type set_type not null default 'working';
