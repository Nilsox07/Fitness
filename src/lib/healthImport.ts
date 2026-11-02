// Übernahme von Health-Connect-Werten in die App-Tabellen (Gewicht, Wasser) – vorsichtig:
// nie etwas überschreiben, das du selbst eingetragen hast. Reine Logik, getestet in healthImport.test.ts.

/** Spalten in health_daily aus Migration 0043 – fehlt die Migration, ohne sie speichern. */
export const DAILY_COLUMNS_0043 = [
  'hydration_ml',
  'nutrition_kcal',
  'nutrition_protein_g',
  'mindful_min',
  'strength_sessions',
  'strength_min',
] as const

/** Fehler „Spalte unbekannt“ (Migration noch nicht ausgeführt)? */
export function isMissingColumn(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  return e.code === 'PGRST204' || e.code === '42703' || /column/i.test(e.message ?? '')
}

/** Felder entfernen (für den Speicher-Versuch ohne neue Spalten). */
export function withoutKeys<T extends object>(rows: readonly T[], keys: readonly string[]): Partial<T>[] {
  return rows.map((r) => {
    const o = { ...r } as Record<string, unknown>
    for (const k of keys) delete o[k]
    return o as Partial<T>
  })
}

/**
 * Waagen-Werte, die als Gewicht in die App übernommen werden: nur Tage ohne eigenen Eintrag
 * und nur plausible Werte (20–400 kg).
 */
export function weightImports(
  daily: readonly { date: string; weight_kg?: number | null }[],
  existingDates: Iterable<string>,
): { date: string; weight_kg: number }[] {
  const have = new Set(existingDates)
  const out = new Map<string, number>()
  for (const d of daily) {
    const kg = d.weight_kg
    if (kg == null || !Number.isFinite(kg) || kg < 20 || kg > 400 || have.has(d.date)) continue
    out.set(d.date, Math.round(kg * 10) / 10)
  }
  return [...out.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, weight_kg]) => ({ date, weight_kg }))
}

/**
 * Getrunkenes aus anderen Apps: nur übernehmen, wenn Health Connect mehr kennt als die App
 * (das Größere gewinnt – so wird nie doppelt gezählt und nie etwas verringert).
 */
export function waterImports(
  daily: readonly { date: string; hydration_ml?: number | null }[],
  appMl: ReadonlyMap<string, number>,
): { date: string; ml: number; exists: boolean }[] {
  const out: { date: string; ml: number; exists: boolean }[] = []
  for (const d of daily) {
    const ml = d.hydration_ml != null ? Math.round(d.hydration_ml) : 0
    if (ml <= 0 || ml > 15000) continue
    const have = appMl.get(d.date)
    if (have != null && have >= ml) continue
    out.push({ date: d.date, ml, exists: have != null })
  }
  return out
}
