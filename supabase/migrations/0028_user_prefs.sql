-- =========================================================================
-- 0028 — Persönliche Einstellungen (neue App)
-- Trainingsrhythmus (Wochentage / Reihenfolge / flexibel), Kalorien-Bonus an
-- Trainingstagen, Mahlzeiten-Aufteilung und Tageswechsel-Stunde als JSON am
-- eigenen Profil:
--   { "schedule": {...}, "kcalBonus": 250,
--     "mealSplit": { "breakfast": 25, "lunch": 35, "dinner": 30, "snack": 10 },
--     "dayCutoff": 4 }
-- Idempotent. RLS: profiles_select_own / profiles_update_own / profiles_insert_own
-- (0001) decken Lesen und Schreiben der eigenen Zeile bereits ab.
-- Bis diese Migration läuft, speichert die App die Werte lokal und übernimmt sie
-- danach automatisch.
-- =========================================================================

alter table public.profiles
  add column if not exists prefs jsonb not null default '{}'::jsonb;
