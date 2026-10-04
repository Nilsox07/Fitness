// Reine Helfer für den „Heute"-Start-Screen (Fitness, Neu-Modus):
// Wochenleiste, Vorschlag für das nächste Training, Erholung, letztes Training.

import { isPerformed, isoWeekKey, onlyWorking, setBest1RM, totalVolume } from './analytics'
import { shiftDate } from './day'
import type { SetWithDate } from '../types'

// ---------------------------------------------------------------------------
// Woche
// ---------------------------------------------------------------------------

/** Mo–So der Woche, in der `day` (YYYY-MM-DD) liegt. */
export function weekDates(day: string): string[] {
  const [y, m, d] = day.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay() || 7 // Mo=1 … So=7
  const monday = shiftDate(day, 1 - dow)
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i))
}

/** Anzahl Trainingstage in der Woche von `day`. */
export function sessionsInWeek(dates: string[], day: string): number {
  const key = isoWeekKey(day)
  return new Set(dates.filter((d) => isoWeekKey(d) === key)).size
}

// ---------------------------------------------------------------------------
// Nächstes Training
// ---------------------------------------------------------------------------

/** Grobe Dauer eines Plans: ~8,5 Min pro Übung, auf 5 Min aufgerundet. */
export function estimateMinutes(exerciseCount: number): number {
  if (exerciseCount <= 0) return 0
  return Math.ceil((exerciseCount * 8.5) / 5) * 5
}

interface PlanLike {
  id: string
  exercise_ids: string[]
}

/**
 * Wann wurde ein Plan zuletzt trainiert? Primär über die gemerkte Plan-Zuordnung
 * eines Trainings (`queueDates`, aus localStorage), sonst über die Übungs-
 * Überschneidung: ein Tag zählt, wenn mind. die Hälfte (mind. 1) der Plan-Übungen
 * ausgeführt wurde.
 */
export function lastDoneByPlan(
  plans: PlanLike[],
  sets: Pick<SetWithDate, 'exercise_id' | 'date' | 'reps' | 'reps_right'>[],
  queueDates: Map<string, string> = new Map(),
): Map<string, string | null> {
  const byDate = new Map<string, Set<string>>()
  for (const s of sets) {
    if (!isPerformed(s)) continue
    ;(byDate.get(s.date) ?? byDate.set(s.date, new Set()).get(s.date)!).add(s.exercise_id)
  }
  const out = new Map<string, string | null>()
  for (const p of plans) {
    let last: string | null = queueDates.get(p.id) ?? null
    const ids = new Set(p.exercise_ids)
    if (ids.size > 0) {
      const need = Math.max(1, Math.ceil(ids.size / 2))
      for (const [date, done] of byDate) {
        if (last && date <= last) continue
        let hit = 0
        for (const id of done) if (ids.has(id)) hit++
        if (hit >= need) last = date
      }
    }
    out.set(p.id, last)
  }
  return out
}

/**
 * Vorschlag: der Plan (mit Übungen), der am längsten nicht dran war — nie
 * trainierte zuerst. Bei Gleichstand gewinnt die Reihenfolge der Pläne.
 */
export function suggestNextPlan<T extends PlanLike>(
  plans: T[],
  sets: Pick<SetWithDate, 'exercise_id' | 'date' | 'reps' | 'reps_right'>[],
  queueDates: Map<string, string> = new Map(),
): T | null {
  const candidates = plans.filter((p) => p.exercise_ids.length > 0)
  if (candidates.length === 0) return plans[0] ?? null
  const last = lastDoneByPlan(candidates, sets, queueDates)
  let best = candidates[0]
  for (const p of candidates.slice(1)) {
    const a = last.get(p.id) ?? ''
    const b = last.get(best.id) ?? ''
    if (a < b) best = p
  }
  return best
}

// ---------------------------------------------------------------------------
// Erholung
// ---------------------------------------------------------------------------

export type RecoveryLevel = 'fresh' | 'almost' | 'tired'

/** ≥ 72 h → erholt, 48–72 h → fast, < 48 h → erschöpft (in ganzen Tagen). */
export function recoveryLevel(daysAgo: number | null): RecoveryLevel {
  if (daysAgo == null || daysAgo >= 3) return 'fresh'
  if (daysAgo === 2) return 'almost'
  return 'tired'
}

// ---------------------------------------------------------------------------
// Letztes Training
// ---------------------------------------------------------------------------

export interface LastSessionStats {
  date: string
  sets: number
  volume: number
  prs: number
  /** Dauer in Minuten (aus den Satz-Zeitstempeln), null wenn unplausibel */
  minutes: number | null
  /** Übungs-IDs, meiste Sätze zuerst */
  exerciseIds: string[]
}

/** Kennzahlen des letzten Trainingstags vor `before` (YYYY-MM-DD). */
export function lastSessionStats(sets: SetWithDate[], before: string): LastSessionStats | null {
  const performed = sets.filter((s) => isPerformed(s) && s.date < before)
  if (performed.length === 0) return null
  const date = performed.reduce((m, s) => (s.date > m ? s.date : m), '')
  const day = performed.filter((s) => s.date === date)

  // Rekorde: bestes 1RM einer Übung über allen früheren Bestwerten
  const prior = new Map<string, number>()
  for (const s of onlyWorking(sets)) {
    if (s.date >= date) continue
    prior.set(s.exercise_id, Math.max(prior.get(s.exercise_id) ?? 0, setBest1RM(s)))
  }
  const cur = new Map<string, number>()
  for (const s of onlyWorking(day)) cur.set(s.exercise_id, Math.max(cur.get(s.exercise_id) ?? 0, setBest1RM(s)))
  let prs = 0
  for (const [id, v] of cur) {
    const p = prior.get(id) ?? 0
    if (p > 0 && v > p + 0.01) prs++
  }

  const count = new Map<string, number>()
  for (const s of day) count.set(s.exercise_id, (count.get(s.exercise_id) ?? 0) + 1)
  const exerciseIds = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)

  const times = day.map((s) => Date.parse(s.created_at)).filter((t) => Number.isFinite(t))
  const span = times.length > 1 ? Math.round((Math.max(...times) - Math.min(...times)) / 60000) : 0
  const minutes = span >= 10 && span <= 240 ? span : null

  return { date, sets: day.length, volume: Math.round(totalVolume(day)), prs, minutes, exerciseIds }
}
