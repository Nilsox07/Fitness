// Reine Helfer für die neue Ernährungs-Startseite (Wochenleiste, Mahlzeiten-Karten).
import { shiftDate } from './day'
import type { Meal } from '../types'

/** Die 7 Tage (Mo–So) der Woche, in der `date` (YYYY-MM-DD) liegt. */
export function weekOf(date: string): string[] {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() // 0 = So
  const monday = shiftDate(date, -((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
}

/** Kalorien je Kalendertag aufsummieren. */
export function kcalByDate(entries: readonly { date: string; kcal: number }[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of entries ?? []) map.set(e.date, (map.get(e.date) ?? 0) + (Number(e.kcal) || 0))
  return map
}

/** Empfohlener Anteil des Tagesziels je Mahlzeit (Summe = 1). */
export const MEAL_SHARE: Record<Meal, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
}

/** Empfohlene kcal einer Mahlzeit, auf 10 gerundet; 0 ohne Ziel. */
export function mealRecommendation(meal: Meal, kcalTarget: number): number {
  if (!(kcalTarget > 0)) return 0
  return Math.round((kcalTarget * MEAL_SHARE[meal]) / 10) * 10
}

/** Ganze Zahl mit deutschem Tausenderpunkt („1.240"). */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('de-DE', { maximumFractionDigits: 0 })
}

/** Liter mit Komma, ohne überflüssige Nullen („1,25", „2,5", „0"). */
export function fmtLiters(ml: number): string {
  let s = (Math.max(0, ml) / 1000).toFixed(2)
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s.replace('.', ',')
}

/** Wie viele von `count` Gläsern bei `ml` von `goalMl` gefüllt sind. */
export function filledGlasses(ml: number, goalMl: number, count = 8): number {
  if (!(goalMl > 0) || !(ml > 0)) return 0
  return Math.min(count, Math.floor((ml / goalMl) * count + 1e-9))
}
