-- 0044: Data-API-Rechte für neue Tabellen.
-- Seit dem 30.10.2026 vergibt Supabase für neu angelegte Tabellen im Schema "public" keine
-- automatischen Rechte mehr. Ohne GRANT antwortet die API mit "permission denied".
-- Wer was sehen darf, regeln weiterhin die RLS-Policies – die Rechte öffnen nur die Tür.
-- Kein Zugriff für "anon" (nicht angemeldet). Läuft gefahrlos mehrfach; fehlende Tabellen werden übersprungen.
-- Immer NACH den Migrationen 0036–0043 ausführen.

do $$
declare
  t text;
begin
  -- App (angemeldet) liest und schreibt eigene Zeilen (RLS)
  foreach t in array array[
    'health_activities', 'health_sleep', 'health_daily',
    'cycle_periods', 'cycle_logs',
    'body_measurements', 'saved_meals'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
      execute format('grant select, insert, update, delete on public.%I to service_role', t);
    end if;
  end loop;

  -- Feedback: nur senden und eigenes lesen
  if to_regclass('public.feedback') is not null then
    grant select, insert on public.feedback to authenticated;
    grant select, insert, update, delete on public.feedback to service_role;
  end if;

  -- Statistik: App darf nur schreiben, lesen nur Server/SQL-Editor
  if to_regclass('public.app_events') is not null then
    grant insert on public.app_events to authenticated;
    grant usage, select on sequence public.app_events_id_seq to authenticated;
    grant select, insert, update, delete on public.app_events to service_role;
  end if;

  -- KI-Limits: nur der Server
  if to_regclass('public.ai_calls') is not null then
    grant select, insert, update, delete on public.ai_calls to service_role;
  end if;
end $$;
