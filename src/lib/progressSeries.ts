// Kleine Verlaufsreihen für die Kacheln der Fortschritt-Übersicht (Wochen- bzw. Tageswerte).
// Reine Logik – getestet in progressSeries.test.ts.

import { isoWeekKey } from './analytics'
import { shiftDate } from './day'

/** ISO-Wochen-Schlüssel der letzten n Wochen (älteste zuerst, aktuelle zuletzt). */
export function lastWeeks(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => isoWeekKey(shiftDate(today, -7 * (n - 1 - i))))
}

/** Summe je Woche über die angegebenen Wochen. */
export function weeklySum(items: readonly { date: string; value: number }[], weeks: readonly string[]): number[] {
  const by = new Map<string, number>()
  for (const it of items) {
    const k = isoWeekKey(it.date)
    by.set(k, (by.get(k) ?? 0) + it.value)
  }
  return weeks.map((w) => by.get(w) ?? 0)
}

/** Wert je Tag der letzten n Tage (null = kein Wert; bei mehreren Werten am Tag: Summe). */
export function dailySeries(
  items: readonly { date: string; value: number }[],
  today: string,
  n: number,
): (number | null)[] {
  const by = new Map<string, number>()
  for (const it of items) by.set(it.date, (by.get(it.date) ?? 0) + it.value)
  return Array.from({ length: n }, (_, i) => by.get(shiftDate(today, -(n - 1 - i))) ?? null)
}

/** Veränderung in Prozent (aktuell gegenüber Schnitt der Vorwerte), null wenn nicht sinnvoll. */
export function trendPct(series: readonly (number | null)[]): number | null {
  const vals = series.filter((v): v is number => v != null)
  if (vals.length < 3) return null
  const last = vals[vals.length - 1]
  const prev = vals.slice(0, -1)
  const avg = prev.reduce((a, b) => a + b, 0) / prev.length
  return avg > 0 ? Math.round(((last - avg) / avg) * 100) : null
}
