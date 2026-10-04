// Reine Helfer für den Fortschritt-Tab (Verlauf + Statistik) — testbar.

import { isoWeekKey, isPerformed, setBest1RM, onlyWorking, totalVolume } from '../../lib/analytics'
import { shiftDate } from '../../lib/day'
import type { SetWithDate } from '../../types'

export const MONTHS_LONG = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

/** Montag der Woche eines Datums (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
  return shiftDate(date, -dow)
}

/** KW-Nummer (ISO). */
export function isoWeekNumber(date: string): number {
  return Number(isoWeekKey(date).split('-W')[1])
}

/** „Diese Woche", „Letzte Woche", „KW 38" (bzw. „KW 52 · 2025" in anderen Jahren). */
export function weekGroupLabel(date: string, today: string): string {
  const mon = mondayOf(date)
  const thisMon = mondayOf(today)
  if (mon === thisMon) return 'Diese Woche'
  if (mon === shiftDate(thisMon, -7)) return 'Letzte Woche'
  const key = isoWeekKey(date)
  const [year, w] = key.split('-W')
  return `KW ${Number(w)}${year !== today.slice(0, 4) ? ` · ${year}` : ''}`
}

/** Dauer aus erstem → letztem Satz-Zeitstempel; nur plausible 10–240 Min. */
export function sessionMinutes(sets: Pick<SetWithDate, 'created_at'>[]): number | null {
  const times = sets.map((s) => Date.parse(s.created_at)).filter((t) => Number.isFinite(t))
  if (times.length < 2) return null
  const span = Math.round((Math.max(...times) - Math.min(...times)) / 60000)
  return span >= 10 && span <= 240 ? span : null
}

export interface WorkoutMeta {
  sets: number
  volume: number
  minutes: number | null
  prs: number
  /** Übungs-IDs nach Satzanzahl absteigend */
  exerciseIds: string[]
}

/**
 * Kennzahlen je Training. Rekord = bestes 1RM einer Übung in diesem Training
 * über dem bisherigen Bestwert aller früheren Tage.
 */
export function workoutMetas(allSets: SetWithDate[]): Map<string, WorkoutMeta> {
  const byWorkout = new Map<string, SetWithDate[]>()
  for (const s of allSets) {
    const list = byWorkout.get(s.workout_id)
    if (list) list.push(s)
    else byWorkout.set(s.workout_id, [s])
  }

  // PRs: Tage chronologisch durchgehen, laufende Bestwerte je Übung.
  const working = onlyWorking(allSets)
  const byDate = new Map<string, SetWithDate[]>()
  for (const s of working) {
    const list = byDate.get(s.date)
    if (list) list.push(s)
    else byDate.set(s.date, [s])
  }
  const prsByWorkout = new Map<string, number>()
  const best = new Map<string, number>()
  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)!
    // je Training & Übung das beste 1RM des Tages
    const cur = new Map<string, number>()
    for (const s of day) {
      const k = `${s.workout_id}|${s.exercise_id}`
      cur.set(k, Math.max(cur.get(k) ?? 0, setBest1RM(s)))
    }
    for (const [k, v] of cur) {
      const [wid, exId] = k.split('|')
      const prior = best.get(exId) ?? 0
      if (prior > 0 && v > prior + 0.01) prsByWorkout.set(wid, (prsByWorkout.get(wid) ?? 0) + 1)
    }
    for (const [k, v] of cur) {
      const exId = k.split('|')[1]
      best.set(exId, Math.max(best.get(exId) ?? 0, v))
    }
  }

  const out = new Map<string, WorkoutMeta>()
  for (const [wid, sets] of byWorkout) {
    const done = sets.filter(isPerformed)
    const count = new Map<string, number>()
    for (const s of done) count.set(s.exercise_id, (count.get(s.exercise_id) ?? 0) + 1)
    out.set(wid, {
      sets: done.length,
      volume: Math.round(totalVolume(done)),
      minutes: sessionMinutes(done),
      prs: prsByWorkout.get(wid) ?? 0,
      exerciseIds: [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
    })
  }
  return out
}

/** Volumen kompakt: „12,4 t" bzw. „850 kg". */
export function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`
  return `${Math.round(kg).toLocaleString('de-DE')} kg`
}

/**
 * Monatsraster Mo–So: Wochenzeilen mit Datum oder null (Füllzellen).
 * `month` = YYYY-MM.
 */
export function monthGrid(month: string): (string | null)[][] {
  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const days = new Date(y, m, 0).getDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let i = 0; i < days; i++) cells.push(shiftDate(first, i))
  while (cells.length % 7) cells.push(null)
  const rows: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
}

/** Monat verschieben: „2026-10" + (−1) → „2026-09". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Intensitätsstufe 1–4 relativ zum größten Tagesvolumen. */
export function intensityLevel(volume: number, max: number): 1 | 2 | 3 | 4 {
  if (!(max > 0) || !(volume > 0)) return 1
  const r = volume / max
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1
}
