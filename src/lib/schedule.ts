// Trainingsrhythmus: feste Wochentage, Reihenfolge (Rotation) oder flexibel.
// Reine Logik (ohne UI/DB), damit testbar. Datumswerte sind Trainings-Tage (YYYY-MM-DD).

import { isPerformed } from './analytics'
import { shiftDate } from './day'
import type { WorkoutSet } from '../types'

/** Plan-ID oder `null` = Ruhetag. */
export type ScheduleStep = string | null

/** Ausdrücklich gesetzte Position in der Rotation („Wo stehe ich gerade?"). */
export interface RotationAnchor {
  /** Index des NÄCHSTEN Schritts (nach dem Stand am Ende von `date`). */
  stepIndex: number
  /** Stand gilt zum Ende dieses Tages; Trainings danach rücken weiter. */
  date: string
}

export type Schedule =
  | {
      type: 'weekdays'
      /** Index 0 = Montag … 6 = Sonntag */
      days: ScheduleStep[]
    }
  | {
      type: 'rotation'
      steps: ScheduleStep[]
      anchor?: RotationAnchor | null
    }
  | {
      type: 'flexible'
      /** Trainings pro Woche (1–7) */
      perWeek: number
    }

export type ScheduleType = Schedule['type']

/** Ein abgeschlossenes Training: Tag + zugeordneter Plan (null = frei / unbekannt). */
export interface HistoryEntry {
  date: string
  planId: string | null
}

export type TodayPlan = { kind: 'train'; planId: string } | { kind: 'rest' } | { kind: 'free' }

export interface UpcomingDay {
  date: string
  /** 0 = Mo … 6 = So */
  weekday: number
  plan: TodayPlan
  /** An diesem Tag wurde bereits trainiert (nur heute möglich). */
  done?: boolean
}

/** Standard-Wochenziel ohne festgelegten Rhythmus. */
export const DEFAULT_WEEKLY_GOAL = 3

export const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

// ---------------------------------------------------------------------------
// Helfer
// ---------------------------------------------------------------------------

/** Wochentag von YYYY-MM-DD, 0 = Montag … 6 = Sonntag. */
export function weekdayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

/** Ganze Tage von `a` bis `b` (b − a), DST-sicher. */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Hat der Rhythmus etwas festgelegt (mind. ein Trainingstag)? Flexibel zählt immer. */
export function isConfigured(s: Schedule | null | undefined): s is Schedule {
  if (!s) return false
  if (s.type === 'flexible') return true
  if (s.type === 'weekdays') return s.days.some(Boolean)
  return s.steps.some(Boolean)
}

/** Legt der Rhythmus die Trainingstage fest (Wochentage/Rotation)? */
export function definesDays(s: Schedule | null | undefined): boolean {
  return isConfigured(s) && s.type !== 'flexible'
}

/**
 * Entfernt Verweise auf gelöschte Pläne: Wochentage → Ruhetag, Rotation →
 * Schritt fällt weg (Anker wird mitgezogen). Unverändert, wenn alles passt.
 */
export function sanitizeSchedule(s: Schedule | null | undefined, planIds: ReadonlySet<string>): Schedule | null {
  if (!s) return null
  if (s.type === 'flexible') return { type: 'flexible', perWeek: clamp(Math.round(s.perWeek) || 1, 1, 7) }
  if (s.type === 'weekdays') {
    const days = Array.from({ length: 7 }, (_, i) => {
      const id = s.days[i] ?? null
      return id && planIds.has(id) ? id : null
    })
    return { type: 'weekdays', days }
  }
  const steps: ScheduleStep[] = []
  let removedBefore = 0
  const orig = s.anchor ?? null
  s.steps.forEach((id, i) => {
    if (id && !planIds.has(id)) {
      if (orig && i < orig.stepIndex) removedBefore++
      return
    }
    steps.push(id ?? null)
  })
  const anchor =
    orig && steps.length > 0
      ? { ...orig, stepIndex: clamp(orig.stepIndex - removedBefore, 0, steps.length - 1) }
      : null
  return { type: 'rotation', steps, anchor }
}

// ---------------------------------------------------------------------------
// Plan ↔ Training
// ---------------------------------------------------------------------------

interface PlanLike {
  id: string
  exercise_ids: string[]
}

/**
 * Abgeschlossene Trainings mit Plan-Zuordnung, aufsteigend nach Datum (ein Eintrag
 * pro Trainings-Tag). Zuordnung primär über die gemerkte Plan-Vorlage des Trainings
 * (`queueByDate`), sonst über die Übungs-Überschneidung (mind. die Hälfte der
 * Plan-Übungen, wie `lastDoneByPlan`); bei mehreren passenden Plänen gewinnt der
 * mit dem höchsten Anteil, dann die Reihenfolge der Pläne.
 */
export function buildHistory(
  plans: readonly PlanLike[],
  sets: readonly (Pick<WorkoutSet, 'exercise_id' | 'reps'> & Partial<Pick<WorkoutSet, 'reps_right'>> & { date: string })[],
  queueByDate: ReadonlyMap<string, string> = new Map(),
): HistoryEntry[] {
  const byDate = new Map<string, Set<string>>()
  for (const s of sets) {
    if (!isPerformed(s)) continue
    ;(byDate.get(s.date) ?? byDate.set(s.date, new Set()).get(s.date)!).add(s.exercise_id)
  }
  const known = new Set(plans.map((p) => p.id))
  const out: HistoryEntry[] = []
  for (const date of [...byDate.keys()].sort()) {
    const queued = queueByDate.get(date)
    if (queued && known.has(queued)) {
      out.push({ date, planId: queued })
      continue
    }
    const done = byDate.get(date)!
    let best: string | null = null
    let bestRatio = 0
    for (const p of plans) {
      const ids = new Set(p.exercise_ids)
      if (ids.size === 0) continue
      let hit = 0
      for (const id of done) if (ids.has(id)) hit++
      if (hit < Math.max(1, Math.ceil(ids.size / 2))) continue
      const ratio = hit / ids.size
      if (ratio > bestRatio) {
        best = p.id
        bestRatio = ratio
      }
    }
    out.push({ date, planId: best })
  }
  return out
}

// ---------------------------------------------------------------------------
// Rotation
// ---------------------------------------------------------------------------

interface RotationState {
  /** Index des nächsten Schritts */
  pos: number
  /** Tag des letzten (zugeordneten) Trainings bzw. des Ankers */
  lastDate: string | null
}

/**
 * Stand der Rotation nach allen Trainings in `history` (bereits gefiltert):
 * jedes Training mit einem Plan aus der Rotation springt auf das nächste
 * Vorkommen dieses Plans ab der aktuellen Position und rückt dahinter.
 * Trainings ohne passenden Plan verändern die Position nicht.
 */
function replayRotation(steps: ScheduleStep[], anchor: RotationAnchor | null | undefined, history: HistoryEntry[]): RotationState {
  const L = steps.length
  let pos = 0
  let lastDate: string | null = null
  let list = history
  if (anchor) {
    pos = ((Math.round(anchor.stepIndex) % L) + L) % L
    lastDate = anchor.date
    list = history.filter((h) => h.date > anchor.date)
  }
  for (const h of [...list].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    if (!h.planId) continue
    for (let i = 0; i < L; i++) {
      const idx = (pos + i) % L
      if (steps[idx] === h.planId) {
        pos = (idx + 1) % L
        lastDate = h.date
        break
      }
    }
  }
  return { pos, lastDate }
}

/**
 * Was steht am Tag `day` an? Ruhetage nach dem letzten Training zählen nur,
 * solange seitdem nicht mehr Tage vergangen sind: Ruhe-Schritte, deren Tag schon
 * verstrichen ist, werden übersprungen. Verpasste Tage verschieben nichts.
 */
function resolveRotation(steps: ScheduleStep[], st: RotationState, day: string): { plan: TodayPlan; index: number } {
  const L = steps.length
  let rest = 0
  while (rest < L && steps[(st.pos + rest) % L] == null) rest++
  if (rest >= L) return { plan: { kind: 'free' }, index: st.pos }
  if (rest > 0) {
    // Seit dem letzten Training verstrichene Ruhetage (ohne heute)
    const served = st.lastDate == null ? Infinity : daysBetween(st.lastDate, day) - 1
    if (served < rest) return { plan: { kind: 'rest' }, index: (st.pos + Math.max(0, served)) % L }
  }
  const index = (st.pos + rest) % L
  return { plan: { kind: 'train', planId: steps[index]! }, index }
}

/** Index des nächsten Schritts (für „Wo stehe ich gerade?"), oder null. */
export function rotationPosition(schedule: Schedule | null | undefined, history: HistoryEntry[], today: string): number | null {
  if (!schedule || schedule.type !== 'rotation' || schedule.steps.length === 0) return null
  return resolveRotation(
    schedule.steps,
    replayRotation(schedule.steps, schedule.anchor, history.filter((h) => h.date < today)),
    today,
  ).index
}

/**
 * Anker für „Wo stehe ich gerade?": `stepIndex` soll der nächste Schritt sein.
 * Wurde heute schon trainiert, gilt der Stand ab Ende von heute (das heutige
 * Training rückt nicht mehr weiter), sonst ab Ende von gestern.
 */
export function makeAnchor(stepIndex: number, history: HistoryEntry[], today: string): RotationAnchor {
  const trainedToday = history.some((h) => h.date === today)
  return { stepIndex, date: trainedToday ? today : shiftDate(today, -1) }
}

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

/**
 * Was steht heute an? Berücksichtigt nur Trainings VOR `today`.
 * - Wochentage: fester Plan oder Ruhetag.
 * - Rotation: nächster Schritt nach dem letzten abgeschlossenen Training.
 * - Flexibel / nicht festgelegt: 'free' (App schlägt vor).
 */
export function todayPlan(schedule: Schedule | null | undefined, history: HistoryEntry[], today: string): TodayPlan {
  if (!isConfigured(schedule) || schedule.type === 'flexible') return { kind: 'free' }
  if (schedule.type === 'weekdays') {
    const id = schedule.days[weekdayIndex(today)] ?? null
    return id ? { kind: 'train', planId: id } : { kind: 'rest' }
  }
  const prior = history.filter((h) => h.date < today)
  return resolveRotation(schedule.steps, replayRotation(schedule.steps, schedule.anchor, prior), today).plan
}

/**
 * Wochenziel aus dem Rhythmus: Wochentage = Anzahl Trainingstage, Rotation =
 * Trainingsschritte pro Zyklus auf 7 Tage hochgerechnet (gerundet, 1–7),
 * flexibel = eingestellte Zahl. Ohne Rhythmus: 3.
 */
export function weeklyGoal(schedule: Schedule | null | undefined): number {
  if (!isConfigured(schedule)) return DEFAULT_WEEKLY_GOAL
  if (schedule.type === 'flexible') return clamp(Math.round(schedule.perWeek) || DEFAULT_WEEKLY_GOAL, 1, 7)
  if (schedule.type === 'weekdays') return schedule.days.filter(Boolean).length
  const train = schedule.steps.filter(Boolean).length
  return clamp(Math.round((train * 7) / schedule.steps.length), 1, 7)
}

/**
 * Vorschau der nächsten `n` Tage ab heute. Rotation: geplante Trainings gelten in
 * der Vorschau als erledigt; ein heute bereits absolviertes Training zählt real.
 */
export function upcoming(
  schedule: Schedule | null | undefined,
  history: HistoryEntry[],
  today: string,
  n = 7,
): UpcomingDay[] {
  const days = Array.from({ length: Math.max(0, n) }, (_, k) => shiftDate(today, k))
  const doneToday = history.some((h) => h.date === today)
  if (!isConfigured(schedule) || schedule.type !== 'rotation') {
    return days.map((date, k) => ({
      date,
      weekday: weekdayIndex(date),
      plan: todayPlan(schedule, history, date),
      ...(k === 0 && doneToday ? { done: true } : {}),
    }))
  }
  const { steps, anchor } = schedule
  const prior = history.filter((h) => h.date < today)
  let st = replayRotation(steps, anchor, prior)
  const out: UpcomingDay[] = []
  days.forEach((date, k) => {
    if (k === 0 && doneToday) {
      const todays = history.filter((h) => h.date === today)
      const planned = resolveRotation(steps, st, date).plan
      const actual = todays.find((h) => h.planId && steps.includes(h.planId))
      st = replayRotation(steps, anchor, [...prior, ...todays])
      out.push({
        date,
        weekday: weekdayIndex(date),
        plan: actual?.planId ? { kind: 'train', planId: actual.planId } : planned,
        done: true,
      })
      return
    }
    const r = resolveRotation(steps, st, date)
    if (r.plan.kind === 'train') st = { pos: (r.index + 1) % steps.length, lastDate: date }
    out.push({ date, weekday: weekdayIndex(date), plan: r.plan })
  })
  return out
}

/** Geplante Trainingstage (YYYY-MM-DD) aus `dates` — nur für Wochentage/Rotation. */
export function plannedTrainingDates(
  schedule: Schedule | null | undefined,
  history: HistoryEntry[],
  today: string,
  dates: string[],
): Set<string> {
  const out = new Set<string>()
  if (!definesDays(schedule)) return out
  if (schedule!.type === 'weekdays') {
    for (const d of dates) if (schedule!.days[weekdayIndex(d)]) out.add(d)
    return out
  }
  const future = dates.filter((d) => d >= today).sort()
  if (future.length === 0) return out
  const n = daysBetween(today, future[future.length - 1]) + 1
  for (const u of upcoming(schedule, history, today, n)) {
    if (u.plan.kind === 'train' && future.includes(u.date)) out.add(u.date)
  }
  return out
}

/** Kurzbeschreibung für die Profil-Zeile, z. B. „Rotation · 3 Tage + Ruhetag". */
export function describeSchedule(schedule: Schedule | null | undefined): string {
  if (!isConfigured(schedule)) return 'Nicht festgelegt'
  if (schedule.type === 'flexible') return `Flexibel · ${weeklyGoal(schedule)}× pro Woche`
  if (schedule.type === 'weekdays') {
    const names = schedule.days.map((d, i) => (d ? WEEKDAY_SHORT[i] : null)).filter(Boolean)
    return `Wochentage · ${names.join(', ')}`
  }
  const train = schedule.steps.filter(Boolean).length
  const rest = schedule.steps.length - train
  const t = `${train} ${train === 1 ? 'Tag' : 'Tage'}`
  return rest === 0 ? `Rotation · ${t}` : `Rotation · ${t} + ${rest === 1 ? 'Ruhetag' : `${rest} Ruhetage`}`
}
