// Meilensteine (neue App): wenige, aussagekräftige Erfolge statt eines großen
// Badge-Rasters. Deterministisch aus den Trainingsdaten; einmal erreicht bleibt
// erreicht (Serie = beste Serie aller Zeiten, nicht die aktuelle).

import type { SetWithDate } from '../types'
import { onlyWorking, sessionDates, setBest1RM } from './analytics'
import { shiftDate } from './day'

export interface Milestone {
  id: string
  label: string
  icon: string
  done: boolean
}

/** Montag (YYYY-MM-DD) der Woche eines Datums — lokal, ohne UTC-Parsing. */
function mondayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() || 7
  return shiftDate(date, -(dow - 1))
}

/** Längste Serie aufeinanderfolgender Wochen mit mindestens einem Training. */
export function longestWeekStreak(dates: string[]): number {
  const weeks = [...new Set(dates.map(mondayOf))].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const w of weeks) {
    run = prev && shiftDate(prev, 7) === w ? run + 1 : 1
    best = Math.max(best, run)
    prev = w
  }
  return best
}

/** Gab es je einen Rekord (besseres geschätztes 1RM als an allen früheren Tagen)? */
export function hasEverSetRecord(sets: SetWithDate[]): boolean {
  const byDay = new Map<string, Map<string, number>>() // Datum → Übung → bestes 1RM
  for (const s of onlyWorking(sets)) {
    const e1 = setBest1RM(s)
    if (e1 <= 0) continue
    const day = byDay.get(s.date) ?? new Map<string, number>()
    day.set(s.exercise_id, Math.max(day.get(s.exercise_id) ?? 0, e1))
    byDay.set(s.date, day)
  }
  const best = new Map<string, number>()
  for (const date of [...byDay.keys()].sort()) {
    for (const [ex, e1] of byDay.get(date)!) {
      const before = best.get(ex) ?? 0
      if (before > 0 && e1 > before + 0.01) return true
      best.set(ex, Math.max(before, e1))
    }
  }
  return false
}

/** Schwerstes ausgeführtes Gewicht eines Arbeitssatzes (einseitig: stärkere Seite). */
function maxWeight(sets: SetWithDate[]): number {
  return onlyWorking(sets).reduce(
    (m, s) => Math.max(m, s.reps > 0 ? s.weight : 0, (s.reps_right ?? 0) > 0 ? (s.weight_right ?? 0) : 0),
    0,
  )
}

/** Die (max. 8) Meilensteine der neuen App. */
export function milestones(sets: SetWithDate[]): Milestone[] {
  const dates = sessionDates(sets)
  const sessions = dates.length
  const streak = longestWeekStreak(dates)
  const m = (id: string, label: string, icon: string, done: boolean): Milestone => ({ id, label, icon, done })
  return [
    m('first', 'Erstes Training', '🎉', sessions >= 1),
    m('s10', '10 Trainings', '🔟', sessions >= 10),
    m('pr', 'Erster Rekord', '🏆', hasEverSetRecord(sets)),
    m('streak4', '4 Wochen Serie', '🔥', streak >= 4),
    m('s50', '50 Trainings', '🏅', sessions >= 50),
    m('kg100', '100-kg-Klub', '🏋️', maxWeight(sets) >= 100),
    m('streak12', '12 Wochen Serie', '🌋', streak >= 12),
    m('s100', '100 Trainings', '💯', sessions >= 100),
  ]
}
