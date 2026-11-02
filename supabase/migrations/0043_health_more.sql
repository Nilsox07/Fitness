-- Mehr aus Health Connect: Werte aus anderen Apps je Tag und Herkunft übernommener Waagen-Werte.
-- Idempotent – kann mehrfach laufen. Ohne diese Migration speichert die App einfach ohne die neuen Spalten.

-- Teil 1: Tageswerte aus anderen Apps (nur für Erkenntnisse, nie doppelt mit dem eigenen Tagebuch gezählt)
alter table public.health_daily
  add column if not exists hydration_ml integer,        -- Getrunkenes laut Health Connect
  add column if not exists nutrition_kcal integer,      -- Essen aus anderen Apps (kcal)
  add column if not exists nutrition_protein_g real,    -- Eiweiß aus anderen Apps (g)
  add column if not exists mindful_min smallint,        -- Achtsamkeit/Meditation (min)
  add column if not exists strength_sessions smallint,  -- Krafttraining, das andere Apps aufgezeichnet haben
  add column if not exists strength_min smallint;

-- Teil 2: Herkunft eines Gewichts (null = selbst eingetragen, 'health' = Waage über Health Connect)
alter table public.body_weights
  add column if not exists source text;
