// Hybrid: Kraft und Ausdauer in einer Woche so abstimmen, dass sich beides nicht ausbremst.
// Faustregeln aus der Forschung zum „Interferenz-Effekt“: harte Ausdauer (Intervalle, lange Einheiten)
// nicht direkt vor oder am Beintag; lockere Einheiten (Zone 2) stören kaum – am selben Tag nach dem Krafttraining.
// Reine Logik – getestet in hybrid.test.ts.

import type { CardioSession } from './onboarding'
import { cardioTitle } from './onboarding'
import { WEEKDAY_SHORT } from './schedule'

/** Muskeln, die einen Tag zum „Beintag“ machen */
const LEG = new Set(['Beine', 'Beinbeuger', 'Gesäß'])

export interface GymDay {
  /** 0 = Mo … 6 = So */
  day: number
  gym: boolean
  legs: boolean
  planName?: string
}

export type IssueKind = 'hard-on-legs' | 'hard-before-legs' | 'hard-after-legs' | 'easy-on-legs' | 'hard-twice'

export interface HybridIssue {
  kind: IssueKind
  day: number
  severity: 'warn' | 'hint'
  text: string
}

/** Belastet die Einheit die Beine spürbar? Intervalle und lange Einheiten ab 60 min. */
export const isHard = (s: Pick<CardioSession, 'type' | 'minutes'>) =>
  s.type === 'interval' || (s.type === 'long' && s.minutes >= 60)

/** Beintag: mindestens 2 Bein-Übungen oder ein Drittel des Plans. */
export function isLegPlan(exerciseIds: readonly string[], muscleOf: (id: string) => string | undefined): boolean {
  const legs = exerciseIds.filter((id) => LEG.has(muscleOf(id) ?? '')).length
  return legs >= 2 || (exerciseIds.length > 0 && legs / exerciseIds.length >= 1 / 3)
}

const next = (d: number) => (d + 1) % 7
const prev = (d: number) => (d + 6) % 7

/** Was in dieser Woche nicht gut zusammenpasst (wichtigstes zuerst). */
export function hybridIssues(sessions: readonly CardioSession[], week: readonly GymDay[]): HybridIssue[] {
  const by = new Map(week.map((w) => [w.day, w]))
  const out: HybridIssue[] = []
  const wd = (d: number) => WEEKDAY_SHORT[d]
  for (const s of sessions) {
    const today = by.get(s.day)
    const tomorrow = by.get(next(s.day))
    const yesterday = by.get(prev(s.day))
    if (isHard(s)) {
      if (today?.legs)
        out.push({
          kind: 'hard-on-legs',
          day: s.day,
          severity: 'warn',
          text: `${wd(s.day)}: ${cardioTitle(s)} am Beintag – Kraft leidet, besser anderer Tag`,
        })
      else if (tomorrow?.legs)
        out.push({
          kind: 'hard-before-legs',
          day: s.day,
          severity: 'warn',
          text: `${wd(s.day)}: ${cardioTitle(s)} direkt vor dem Beintag – Beine kommen müde ins Gym`,
        })
      else if (yesterday?.legs)
        out.push({
          kind: 'hard-after-legs',
          day: s.day,
          severity: 'hint',
          text: `${wd(s.day)}: Am Tag nach dem Beintag sind Intervalle oft zäh – locker geht besser`,
        })
      if (sessions.some((o) => o !== s && isHard(o) && o.day === next(s.day)))
        out.push({
          kind: 'hard-twice',
          day: s.day,
          severity: 'hint',
          text: `${wd(s.day)} und ${wd(next(s.day))}: zwei harte Einheiten hintereinander`,
        })
    } else if (today?.legs) {
      out.push({
        kind: 'easy-on-legs',
        day: s.day,
        severity: 'hint',
        text: `${wd(s.day)}: Ausdauer nach dem Krafttraining machen, dann leidet die Kraft nicht`,
      })
    }
  }
  return out.sort((a, b) => (a.severity === b.severity ? a.day - b.day : a.severity === 'warn' ? -1 : 1))
}

/** Strafpunkte eines Tages für eine Einheit (kleiner = besser). */
function dayPenalty(
  s: CardioSession,
  day: number,
  week: Map<number, GymDay>,
  taken: Map<number, CardioSession>,
): number {
  if (taken.has(day)) return 1000
  const t = week.get(day)
  const tomorrow = week.get(next(day))
  const yesterday = week.get(prev(day))
  const hard = isHard(s)
  let p = 0
  if (t?.legs) p += hard ? 40 : 6
  else if (t?.gym) p += hard ? 8 : 2
  if (tomorrow?.legs) p += hard ? 30 : 2
  if (yesterday?.legs) p += hard ? 14 : 0
  if (hard) {
    const n = taken.get(next(day))
    const pr = taken.get(prev(day))
    if ((n && isHard(n)) || (pr && isHard(pr))) p += 10
  }
  // Nicht ohne Grund verschieben
  if (day !== s.day) p += 1
  return p
}

function score(sessions: readonly CardioSession[], week: readonly GymDay[]): number {
  return hybridIssues(sessions, week).reduce((n, i) => n + (i.severity === 'warn' ? 10 : 1), 0)
}

/**
 * Ausdauer-Tage passend zu den Krafttagen verteilen: harte Einheiten zuerst an die besten Tage,
 * dann die lockeren. Gibt null zurück, wenn es nichts zu verbessern gibt.
 */
export function arrangeCardio(sessions: readonly CardioSession[], week: readonly GymDay[]): CardioSession[] | null {
  if (!sessions.length || !week.some((w) => w.gym)) return null
  const by = new Map(week.map((w) => [w.day, w]))
  const order = [...sessions].sort((a, b) => Number(isHard(b)) - Number(isHard(a)) || b.minutes - a.minutes)
  const taken = new Map<number, CardioSession>()
  const placed: CardioSession[] = []
  for (const s of order) {
    let best = s.day
    let bestP = Infinity
    for (let d = 0; d < 7; d++) {
      const p = dayPenalty(s, d, by, taken)
      if (p < bestP) {
        bestP = p
        best = d
      }
    }
    const moved = { ...s, day: best }
    taken.set(best, moved)
    placed.push(moved)
  }
  const result = placed.sort((a, b) => a.day - b.day)
  return score(result, week) < score(sessions, week) ? result : null
}

/**
 * Heute: harte Einheit, aber morgen Beine (oder heute Beine)? → lieber locker.
 * Gibt einen kurzen Hinweis zurück oder null.
 */
export function todayAdvice(session: CardioSession | undefined, week: readonly GymDay[]): string | null {
  if (!session) return null
  const by = new Map(week.map((w) => [w.day, w]))
  if (isHard(session) && by.get(next(session.day))?.legs) return 'Morgen ist Beintag – heute lieber locker statt hart'
  if (isHard(session) && by.get(session.day)?.legs)
    return 'Heute auch Beine – erst Gym, Ausdauer locker oder mit 6 h Abstand'
  if (!isHard(session) && by.get(session.day)?.gym) return 'Tipp: Ausdauer nach dem Krafttraining'
  return null
}
