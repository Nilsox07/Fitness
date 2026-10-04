// Reine Helfer für den Ernährungs-Fortschritt (Tage-Kalender, Statistik).
import { shiftDate } from './day'

export interface FoodDayTotals {
  kcal: number
  protein: number
  carbs: number
  fat: number
  count: number
}

/** Tageswerte (inkl. Makros und Anzahl Einträge) je Kalendertag. */
export function foodTotalsByDate(
  entries: readonly { date: string; kcal: number; protein: number; carbs: number; fat: number }[] | null | undefined,
): Map<string, FoodDayTotals> {
  const m = new Map<string, FoodDayTotals>()
  for (const e of entries ?? []) {
    const d = m.get(e.date) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
    d.kcal += Number(e.kcal) || 0
    d.protein += Number(e.protein) || 0
    d.carbs += Number(e.carbs) || 0
    d.fat += Number(e.fat) || 0
    d.count++
    m.set(e.date, d)
  }
  return m
}

export type KcalStatus = 'empty' | 'ok' | 'over' | 'under' | 'logged'

/** Bewertung eines Tages: im Ziel (±10 %), drüber, drunter; ohne Ziel nur „logged". */
export function kcalStatus(kcal: number, target: number, logged = kcal > 0): KcalStatus {
  if (!logged) return 'empty'
  if (!(target > 0)) return 'logged'
  if (Math.abs(kcal - target) <= target * 0.1) return 'ok'
  return kcal > target ? 'over' : 'under'
}

/**
 * Kalenderraster eines Monats (Mo–So): Wochen à 7 Zellen, Füllzellen = null.
 * `month` ist 1-basiert.
 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = `${year}-${String(month).padStart(2, '0')}-01`
  const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Mo = 0
  const len = new Date(year, month, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let i = 0; i < len; i++) cells.push(shiftDate(first, i))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

/** Monat um `delta` verschieben. `month` 1-basiert. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

/** „Oktober 2026" */
export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
}

/**
 * Log-Übersicht der letzten `days` Tage (inkl. heute): wie viele Tage geloggt,
 * Ø kcal über abgeschlossene geloggte Tage (ohne heute, da noch unvollständig).
 */
export function loggedSummary(
  totals: Map<string, { kcal: number }>,
  today: string,
  days = 30,
): { logged: number; days: number; avgKcal: number | null } {
  let logged = 0
  let sum = 0
  let n = 0
  for (let i = 0; i < days; i++) {
    const d = shiftDate(today, -i)
    const v = totals.get(d)
    if (!v) continue
    logged++
    if (d !== today) {
      sum += v.kcal
      n++
    }
  }
  return { logged, days, avgKcal: n ? Math.round(sum / n) : null }
}

/** Anteil der Makros an den Kalorien (Eiweiß/KH 4 kcal/g, Fett 9 kcal/g), in %, Summe 100. */
export function macroSplit(protein: number, carbs: number, fat: number): { protein: number; carbs: number; fat: number } {
  const p = Math.max(0, protein) * 4
  const c = Math.max(0, carbs) * 4
  const f = Math.max(0, fat) * 9
  const total = p + c + f
  if (total <= 0) return { protein: 0, carbs: 0, fat: 0 }
  const pp = Math.round((p / total) * 100)
  const cp = Math.round((c / total) * 100)
  return { protein: pp, carbs: cp, fat: Math.max(0, 100 - pp - cp) }
}

export type ProteinDot = { date: string; state: 'hit' | 'miss' | 'empty' }

/** Eiweiß-Ziel der letzten `n` Tage (ältester zuerst, heute zuletzt). */
export function proteinDots(
  totals: Map<string, { protein: number }>,
  today: string,
  target: number,
  n = 14,
): ProteinDot[] {
  return Array.from({ length: n }, (_, i) => {
    const date = shiftDate(today, i - (n - 1))
    const v = totals.get(date)
    const state: ProteinDot['state'] = !v ? 'empty' : target > 0 && v.protein >= target ? 'hit' : 'miss'
    return { date, state }
  })
}

/** Aufeinanderfolgende Tage mit erreichtem Eiweiß-Ziel bis heute (heute noch offen → ab gestern). */
export function proteinStreak(totals: Map<string, { protein: number }>, today: string, target: number): number {
  if (!(target > 0)) return 0
  const hit = (d: string) => (totals.get(d)?.protein ?? 0) >= target
  let d = hit(today) ? today : shiftDate(today, -1)
  let s = 0
  while (hit(d)) {
    s++
    d = shiftDate(d, -1)
  }
  return s
}

/** Ist eine Gewichtsveränderung passend zum Ernährungsziel? */
export function weightChangeFitsGoal(change: number, goal: string | null | undefined): boolean {
  if (goal === 'lose') return change <= 0
  if (goal === 'gain') return change >= 0
  return Math.abs(change) <= 0.5
}
