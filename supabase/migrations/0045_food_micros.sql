-- 0045: Geschätzte Vitamine & Mineralstoffe je Eintrag (jsonb, optional).
-- Bestehende Tabelle → keine neuen Rechte nötig. Läuft gefahrlos mehrfach.
alter table public.food_entries add column if not exists micros jsonb;
