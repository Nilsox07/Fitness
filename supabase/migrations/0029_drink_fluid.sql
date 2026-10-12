-- =========================================================================
-- 0029 — Getränke zählen zur Trinkmenge
-- Flüssigkeit eines Ernährungseintrags in ml (Proteinshake, Cola, Latte …).
-- Die Kalorien zählen wie gewohnt, die Menge zusätzlich zur Wasser-Anzeige.
-- Idempotent. RLS der Tabelle food_entries deckt die neue Spalte ab.
-- Bis diese Migration läuft, merkt sich die App die Werte lokal.
-- =========================================================================

alter table public.food_entries
  add column if not exists fluid_ml integer
  check (fluid_ml is null or (fluid_ml >= 0 and fluid_ml <= 5000));
