-- Fitness Tracker — Feinere Muskelgruppen
-- Auszuführen im Supabase SQL-Editor (nach 0007_plans.sql).
--
-- Grund: Die automatische Aufwärmsatz-Logik entscheidet pro Muskelgruppe. Damit
-- Antagonisten (z. B. Quadrizeps/Beinstrecker vs. Beinbeuger) nicht als „schon
-- warm" zusammenfallen, brauchen sie eigene Gruppen. Bestehende „Beine"-Übungen
-- (Beinstrecker, Beinpresse, Kniebeuge) bleiben „Beine"; den Beinbeuger stellst
-- du danach auf „Beinbeuger".
--
-- Hinweis: Neue Enum-Werte können in Postgres nicht in derselben Transaktion
-- verwendet werden, in der sie angelegt wurden — hier kein Problem, da wir die
-- Übungen erst danach umstellen.

alter type muscle_group add value if not exists 'Beinbeuger' after 'Beine';
alter type muscle_group add value if not exists 'Waden'      after 'Beinbeuger';
alter type muscle_group add value if not exists 'Gesäß'      after 'Waden';
alter type muscle_group add value if not exists 'Unterarme'  after 'Trizeps';
