import type { Exercise, SetType, SetWithDate, WorkoutSet } from '../types'

/**
 * Nur die schweren Arbeitssätze — Basis für Kraft-Fortschritt, 1RM, PRs und den
 * Steigerungs-Tipp. Aufwärm- und Dropsätze werden hier ausgeblendet, damit sie
 * die Kraftwerte nicht verfälschen (sie zählen weiterhin ins Gesamt-Volumen).
 */
export function onlyWorking<T extends { set_type: SetType }>(sets: T[]): T[] {
  return sets.filter((s) => s.set_type === 'working')
}

/**
 * Geschätztes 1-Rep-Max (1RM) nach der Epley-Formel.
 * 1RM = Gewicht × (1 + Wdh / 30). Bei 1 Wdh entspricht es dem Gewicht.
 */
export function estimate1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Volumen eines einzelnen Satzes: Wdh × Gewicht. */
export function setVolume(set: Pick<WorkoutSet, 'reps' | 'weight'>): number {
  return set.reps * set.weight
}

/** Gesamtvolumen mehrerer Sätze. */
export function totalVolume(sets: Pick<WorkoutSet, 'reps' | 'weight'>[]): number {
  return sets.reduce((sum, s) => sum + setVolume(s), 0)
}

/** Rundet auf eine Nachkommastelle (für Anzeige/Vergleiche). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// ---------------------------------------------------------------------------
// Sätze zu Trainings-Sessions gruppieren
// ---------------------------------------------------------------------------

export interface SessionSummary {
  date: string
  /** schwerstes in der Session verwendetes Gewicht */
  topWeight: number
  /** bestes geschätztes 1RM der Session */
  bestEstimated1RM: number
  /** Volumen der Session */
  volume: number
  sets: Pick<WorkoutSet, 'reps' | 'weight' | 'set_number' | 'to_failure'>[]
}

/**
 * Fasst Sätze (einer einzelnen Übung) pro Trainingstag zusammen.
 * Ergebnis aufsteigend nach Datum sortiert.
 */
export function summarizeSessions(sets: SetWithDate[]): SessionSummary[] {
  const byDate = new Map<string, SetWithDate[]>()
  for (const s of sets) {
    const list = byDate.get(s.date) ?? []
    list.push(s)
    byDate.set(s.date, list)
  }

  const sessions: SessionSummary[] = []
  for (const [date, daySets] of byDate) {
    const topWeight = Math.max(...daySets.map((s) => s.weight))
    const bestEstimated1RM = Math.max(...daySets.map((s) => estimate1RM(s.weight, s.reps)))
    sessions.push({
      date,
      topWeight,
      bestEstimated1RM: round1(bestEstimated1RM),
      volume: totalVolume(daySets),
      sets: daySets
        .map((s) => ({
          reps: s.reps,
          weight: s.weight,
          set_number: s.set_number,
          to_failure: s.to_failure,
        }))
        .sort((a, b) => a.set_number - b.set_number),
    })
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date))
}

// ---------------------------------------------------------------------------
// Persönliche Rekorde (PRs)
// ---------------------------------------------------------------------------

export interface PersonalRecords {
  maxWeight: number
  maxReps: number
  maxEstimated1RM: number
  maxVolumeSession: number
}

export function personalRecords(allSets: SetWithDate[]): PersonalRecords {
  const sets = onlyWorking(allSets)
  if (sets.length === 0) {
    return { maxWeight: 0, maxReps: 0, maxEstimated1RM: 0, maxVolumeSession: 0 }
  }
  const sessions = summarizeSessions(sets)
  return {
    maxWeight: Math.max(...sets.map((s) => s.weight)),
    maxReps: Math.max(...sets.map((s) => s.reps)),
    maxEstimated1RM: round1(Math.max(...sets.map((s) => estimate1RM(s.weight, s.reps)))),
    maxVolumeSession: Math.max(...sessions.map((s) => s.volume)),
  }
}

// ---------------------------------------------------------------------------
// Wochen-Volumen
// ---------------------------------------------------------------------------

/** ISO-Wochenschlüssel "YYYY-Www" für ein Datum (YYYY-MM-DD). */
export function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export interface WeeklyVolume {
  week: string
  volume: number
}

export function weeklyVolume(sets: SetWithDate[]): WeeklyVolume[] {
  const byWeek = new Map<string, number>()
  for (const s of sets) {
    const key = isoWeekKey(s.date)
    byWeek.set(key, (byWeek.get(key) ?? 0) + setVolume(s))
  }
  return [...byWeek.entries()]
    .map(([week, volume]) => ({ week, volume }))
    .sort((a, b) => a.week.localeCompare(b.week))
}

// ---------------------------------------------------------------------------
// Trainingshäufigkeit
// ---------------------------------------------------------------------------

export interface FrequencyStats {
  totalSessions: number
  /** aktuelle Streak in Wochen (aufeinanderfolgende Wochen mit Training) */
  weekStreak: number
  sessionsPerWeek: number
}

/**
 * @param workoutDates eindeutige Trainings-Daten (YYYY-MM-DD)
 * @param today Referenzdatum (für Tests injizierbar)
 */
export function frequencyStats(workoutDates: string[], today = new Date()): FrequencyStats {
  const unique = [...new Set(workoutDates)].sort()
  if (unique.length === 0) {
    return { totalSessions: 0, weekStreak: 0, sessionsPerWeek: 0 }
  }

  const weeks = new Set(unique.map(isoWeekKey))

  // Streak: ab dieser Woche rückwärts zählen
  let streak = 0
  const cursor = new Date(today)
  // Auf Wochenbeginn-unabhängige Zählung: wir prüfen Wochenschlüssel je 7 Tage zurück
  for (;;) {
    const key = isoWeekKey(cursor.toISOString().slice(0, 10))
    if (weeks.has(key)) {
      streak++
      cursor.setUTCDate(cursor.getUTCDate() - 7)
    } else {
      break
    }
  }

  const first = new Date(unique[0] + 'T00:00:00Z')
  const spanWeeks = Math.max(1, Math.ceil((today.getTime() - first.getTime()) / (7 * 86400000)))

  return {
    totalSessions: unique.length,
    weekStreak: streak,
    sessionsPerWeek: round1(unique.length / spanWeeks),
  }
}

// ---------------------------------------------------------------------------
// Gewichts-Steigerungs-Tipp (Double Progression)
// ---------------------------------------------------------------------------

export type ProgressionAction = 'start' | 'increase' | 'hold' | 'deload'

export interface ProgressionSuggestion {
  action: ProgressionAction
  /** empfohlenes Arbeitsgewicht fürs nächste Training */
  suggestedWeight: number
  reason: string
}

/**
 * Bewertet die letzte(n) Session(s) einer Übung und gibt eine transparente
 * Empfehlung nach dem Prinzip der "Double Progression":
 *  - Alle Arbeitssätze am oberen Ende des Wdh.-Bereichs → Gewicht erhöhen.
 *  - Innerhalb des Bereichs → Gewicht halten, mehr Wdh. anstreben.
 *  - Unter dem Bereich → Gewicht halten, sauber werden.
 *  - Stagnation über mehrere Sessions beim selben Gewicht → Deload.
 */
export function progressionSuggestion(
  exercise: Pick<Exercise, 'target_rep_min' | 'target_rep_max' | 'increment'>,
  allSets: SetWithDate[],
): ProgressionSuggestion {
  // Nur Arbeitssätze bestimmen die Empfehlung
  const sessions = summarizeSessions(onlyWorking(allSets))
  if (sessions.length === 0) {
    return {
      action: 'start',
      suggestedWeight: 0,
      reason: 'Noch keine Daten — tracke dein erstes Training, dann gibt es einen konkreten Tipp.',
    }
  }

  const last = sessions[sessions.length - 1]
  const topWeight = last.topWeight
  const workingSets = last.sets.filter((s) => s.weight === topWeight)
  const minReps = Math.min(...workingSets.map((s) => s.reps))
  const setCount = workingSets.length
  // Wurde am Arbeitsgewicht bis zum Versagen gegangen?
  const reachedFailure = workingSets.some((s) => s.to_failure)
  const { target_rep_min, target_rep_max, increment } = exercise

  // Stagnation: gleiches Top-Gewicht in den letzten 3 Sessions ohne Wdh.-Zuwachs
  const recent = sessions.slice(-3)
  const stalled =
    recent.length >= 3 &&
    recent.every((s) => s.topWeight === topWeight) &&
    minReps < target_rep_max

  if (minReps >= target_rep_max) {
    const next = round1(topWeight + increment)
    const closer = reachedFailure
      ? `alle Sätze am oberen Wdh.-Ziel`
      : `alle Sätze am oberen Ziel und noch Reserve (nicht bis Versagen) — klar steigern`
    return {
      action: 'increase',
      suggestedWeight: next,
      reason: `Letztes Mal ${setCount}×${minReps} @ ${topWeight} kg, ${closer}. Versuch ${next} kg.`,
    }
  }

  if (stalled) {
    const deloaded = round1(topWeight * 0.9)
    return {
      action: 'deload',
      suggestedWeight: deloaded,
      reason: `Seit 3 Trainings bei ${topWeight} kg ohne Zuwachs. Mach einen Deload auf ~${deloaded} kg und arbeite dich wieder hoch.`,
    }
  }

  if (minReps < target_rep_min) {
    return {
      action: 'hold',
      suggestedWeight: topWeight,
      reason: `Letztes Mal nur ${minReps} Wdh. bei ${topWeight} kg. Bleib beim Gewicht, bis du mind. ${target_rep_min} Wdh. sauber schaffst.`,
    }
  }

  // Innerhalb des Bereichs: Gewicht halten, Wdh. steigern
  const within = reachedFailure
    ? `Bleib beim Gewicht, die Wdh. kommen mit der Zeit (Ziel ${target_rep_max}).`
    : `Du hattest noch Reserve — hol mehr Wdh. raus (Ziel ${target_rep_max}), dann steigern.`
  return {
    action: 'hold',
    suggestedWeight: topWeight,
    reason: `Letztes Mal ${setCount}×${minReps} @ ${topWeight} kg. ${within}`,
  }
}
