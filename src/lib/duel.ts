// Wochen-Duell & gemeinsames Wochenziel für die Community.
// Reine Logik (ohne UI/DB), damit testbar. Woche = Montag bis Sonntag (lokal).

import { localDate, shiftDate } from './day'

/** Punkte pro Kategorie. */
export const DUEL_POINTS = {
  /** pro Training in dieser Woche */
  training: 10,
  /** einmalig, sobald das Wochenziel (3 Trainings) erreicht ist */
  goal: 10,
  /** pro Tag mit erreichtem Protein-Ziel */
  protein: 5,
} as const

/**
 * Trainings pro Person und Woche für Duell, Ring und Teamziel.
 * Bewusst fest bei 3: Im Vergleich mit Freunden zählt für alle dasselbe Ziel
 * (das persönliche Ziel aus dem Trainingsrhythmus wird nicht geteilt), damit der
 * „Ziel 3×"-Bonus fair bleibt. Überall sonst gilt das persönliche Wochenziel
 * (`weeklyGoal(schedule)` in `schedule.ts` / `useWeeklyGoal()`).
 */
export const WEEKLY_GOAL = 3

/** Minimale Sicht auf eine geteilte Statistik-Zeile (kompatibel zu `UserStat`). */
export interface DuelStat {
  user_id: string
  weekly_sessions: number
  last_workout: string | null
  protein_week?: number | null
  weekly_volume?: number | null
  monthly_prs?: number | null
  /** Zeitpunkt der letzten Synchronisation (kommt per `select *` mit, falls vorhanden). */
  updated_at?: string | null
}

export interface DuelScore {
  user_id: string
  sessions: number
  proteinDays: number
  training: number
  goal: number
  protein: number
  total: number
}

export interface DuelStandings {
  scores: DuelScore[]
  /** Eindeutige:r Führende:r (null bei Gleichstand an der Spitze oder 0 Punkten). */
  leaderId: string | null
  /** Vorsprung der Spitze auf Platz 2. */
  lead: number
  /** Summe aller Punkte (für das Verhältnis im Balken). */
  sum: number
}

/** Montag der Woche von `today` (YYYY-MM-DD). */
export function weekStart(today = localDate()): string {
  const [y, m, d] = today.split('-').map(Number)
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7 // Mo = 0
  return shiftDate(today, -dow)
}

/** Liegt `date` (YYYY-MM-DD) in derselben Mo–So-Woche wie `today`? */
export function isThisWeek(date: string | null | undefined, today = localDate()): boolean {
  if (!date) return false
  const d = date.slice(0, 10)
  const start = weekStart(today)
  return d >= start && d <= shiftDate(start, 6)
}

/** Verbleibende Tage nach heute bis Sonntag (Sonntag = 0). */
export function daysLeftInWeek(today = localDate()): number {
  const start = weekStart(today)
  let n = 0
  while (shiftDate(today, n + 1) <= shiftDate(start, 6)) n++
  return n
}

/**
 * Trainings dieser Woche — nur wenn die geteilte Zahl auch aus dieser Woche stammt
 * (letztes Training in dieser Woche), sonst 0 (veraltete Vorwochen-Zahl).
 */
export function effectiveSessions(u: DuelStat, today = localDate()): number {
  if (!isThisWeek(u.last_workout, today)) return 0
  return Math.max(0, Math.round(u.weekly_sessions ?? 0))
}

/** Wochen-Volumen — 0, wenn die geteilte Zahl nicht aus dieser Woche stammt. */
export function effectiveWeeklyVolume(u: DuelStat, today = localDate()): number {
  if (!isThisWeek(u.last_workout, today)) return 0
  return Math.max(0, Math.round(u.weekly_volume ?? 0))
}

/** Liegt `date` im selben Kalendermonat wie `today`? */
export function isThisMonth(date: string | null | undefined, today = localDate()): boolean {
  return Boolean(date) && date!.slice(0, 7) === today.slice(0, 7)
}

/**
 * Neue Rekorde diesen Monat — 0, wenn die Zahl aus einem Vormonat stammt
 * (letztes Training bzw. letzte Synchronisation nicht in diesem Monat).
 */
export function effectiveMonthlyPrs(u: DuelStat, today = localDate()): number {
  if (!isThisMonth(u.last_workout, today)) return 0
  if (u.updated_at && !isThisMonth(localDate(new Date(u.updated_at)), today)) return 0
  return Math.max(0, Math.round(u.monthly_prs ?? 0))
}

/**
 * Protein-Ziel-Tage dieser Woche (0–7). Werte > 7 stammen aus der alten
 * Bedeutung (Ø Gramm) und zählen nicht; ist die Zeile nicht aus dieser Woche, 0.
 */
export function effectiveProteinDays(u: DuelStat, today = localDate()): number {
  const v = Math.round(u.protein_week ?? 0)
  if (v <= 0 || v > 7) return 0
  if (u.updated_at && !isThisWeek(localDate(new Date(u.updated_at)), today)) return 0
  return v
}

export function duelScore(u: DuelStat, opts: { includeProtein: boolean; today?: string }): DuelScore {
  const today = opts.today ?? localDate()
  const sessions = effectiveSessions(u, today)
  const proteinDays = opts.includeProtein ? effectiveProteinDays(u, today) : 0
  const training = sessions * DUEL_POINTS.training
  const goal = sessions >= WEEKLY_GOAL ? DUEL_POINTS.goal : 0
  const protein = proteinDays * DUEL_POINTS.protein
  return {
    user_id: u.user_id,
    sessions,
    proteinDays,
    training,
    goal,
    protein,
    total: training + goal + protein,
  }
}

/** Punkte aller Teilnehmer (Reihenfolge bleibt erhalten) + Führende:r. */
export function duelStandings(
  people: DuelStat[],
  opts: { includeProtein: boolean; today?: string },
): DuelStandings {
  const scores = people.map((u) => duelScore(u, opts))
  const sorted = [...scores].sort((a, b) => b.total - a.total)
  const top = sorted[0]?.total ?? 0
  const second = sorted[1]?.total ?? 0
  const leaderId = top > 0 && top > second ? sorted[0].user_id : null
  return {
    scores,
    leaderId,
    lead: leaderId ? top - second : 0,
    sum: scores.reduce((s, x) => s + x.total, 0),
  }
}

export interface TeamGoal {
  done: number
  target: number
  reached: boolean
  /** 0..100 */
  progress: number
  perPerson: { user_id: string; sessions: number }[]
}

/** Kooperatives Wochenziel: WEEKLY_GOAL Trainings pro Person, gemeinsam gezählt. */
export function teamGoal(people: DuelStat[], today = localDate()): TeamGoal {
  const perPerson = people.map((u) => ({ user_id: u.user_id, sessions: effectiveSessions(u, today) }))
  const done = perPerson.reduce((s, p) => s + p.sessions, 0)
  const target = WEEKLY_GOAL * people.length
  return {
    done,
    target,
    reached: target > 0 && done >= target,
    progress: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0,
    perPerson,
  }
}
