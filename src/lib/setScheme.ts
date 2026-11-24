// Welche Sätze legt das Training für eine Übung an? Nicht jeder trainiert gleich:
//  1. Gibt es die Übung schon im Verlauf, wird die übliche Struktur übernommen (Anzahl Arbeitssätze,
//     Dropsätze). „Üblich“ = aus den letzten Einheiten: ein Ausreißer (z. B. einmal nur 1 Satz
//     geschafft) ändert nichts; zweimal hintereinander gleich = bewusst geändert.
//  2. Neue Übung → eigenes Standard-Schema aus den Einstellungen (Standard: 3 Arbeitssätze).
// Aufwärmen „automatisch“ = nur wenn der Muskel heute noch kalt ist – so viele Aufwärmsätze, wie du bei
// kaltem Muskel üblicherweise machst (0, 1, 2 …). Gelernt wird nur aus Einheiten, in denen der Muskel
// damals auch kalt war: Latzug nach Rudern ohne Aufwärmen heißt nicht „wärmt nie auf“.
// Dropsätze „automatisch“ = nur bei Übungen, bei denen du sie machst; „nie“ räumt sie überall weg.
// Reine Logik – getestet in setScheme.test.ts.

import type { SetType } from '../types'

export type WarmupMode = 'auto' | 'always' | 'never'
export type DropMode = 'auto' | 'always' | 'never'

export interface SetScheme {
  /** Arbeitssätze für neue Übungen (1–8) */
  working: number
  warmup: WarmupMode
  drop: DropMode
}

export const DEFAULT_SET_SCHEME: SetScheme = { working: 3, warmup: 'auto', drop: 'auto' }

export function normalizeSetScheme(raw: unknown): SetScheme {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const w = Number(r.working)
  const mode = (v: unknown) => (v === 'always' || v === 'never' ? v : 'auto')
  return {
    working: Number.isFinite(w) ? Math.min(8, Math.max(1, Math.round(w))) : DEFAULT_SET_SCHEME.working,
    warmup: mode(r.warmup),
    // früher ein Schalter „Dropsatz am Ende“ (true = an)
    drop: r.drop === true ? 'always' : mode(r.drop),
  }
}

const workingCount = (types: readonly SetType[]) => types.filter((t) => t === 'working').length

/**
 * Übliche Einheit aus den letzten Einheiten (neueste zuerst): Anzahl Arbeitssätze und die Einheit,
 * deren Aufwärm-/Dropsatz-Struktur gilt.
 *  - nur eine Einheit bekannt: mindestens so viele Sätze wie im eigenen Schema
 *  - die letzten zwei gleich: so übernehmen (bewusst geändert)
 *  - sonst die häufigste Anzahl (bei Gleichstand die größere)
 */
export function usualSession(
  sessions: readonly (readonly SetType[])[],
  scheme: SetScheme,
): { working: number; ref: readonly SetType[] } {
  const done = sessions.filter((t) => t.length > 0).slice(0, 4)
  if (!done.length) return { working: scheme.working, ref: [] }
  const counts = done.map((t) => Math.max(1, workingCount(t)))
  let working: number
  if (counts.length === 1) working = Math.max(counts[0], scheme.working)
  else if (counts[0] === counts[1]) working = counts[0]
  else {
    const freq = new Map<number, number>()
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1)
    working = [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]
  }
  const ref = done.find((t) => Math.max(1, workingCount(t)) === working) ?? done[0]
  return { working: Math.min(8, working), ref }
}

const countOf = (types: readonly SetType[], t: SetType) => types.filter((x) => x === t).length

/** Gelernte Aufwärm-Gewohnheit (siehe warmupHabit). null = noch nichts bekannt. */
export interface WarmupHistory {
  /** Übliche Anzahl Aufwärmsätze bei DIESER Übung, wenn der Muskel kalt war */
  exercise: number | null
  /** Sonst: üblich bei derselben Muskelgruppe, sonst bei der ersten Übung eines Trainings */
  habit: number | null
}

/** Wie viele Aufwärmsätze, wenn der Muskel kalt ist? Übung vor Gewohnheit, sonst einer. */
export function coldWarmupCount(h: WarmupHistory | undefined, last: readonly SetType[]): number {
  if (h) return Math.min(4, h.exercise ?? h.habit ?? 1)
  // ohne Verlauf-Auswertung: wie bei der Übung zuletzt (neue Übung: einer)
  return last.length === 0 ? 1 : countOf(last, 'warmup')
}

export function planSetTypes(opts: {
  scheme: SetScheme
  /** Satz-Typen der letzten Einheit dieser Übung (Reihenfolge egal), leer = neue Übung */
  last: readonly SetType[]
  /** Letzte Einheiten (neueste zuerst) – wenn angegeben, zählt die übliche statt der letzten */
  sessions?: readonly (readonly SetType[])[]
  /** Muskelgruppe heute schon warm (andere Übung derselben Gruppe trainiert) */
  muscleWarm: boolean
  /** Aufwärm-Gewohnheit aus dem Verlauf (warmupHabit) */
  warmups?: WarmupHistory
}): SetType[] {
  const { scheme, muscleWarm } = opts
  const usual = opts.sessions?.length ? usualSession(opts.sessions, scheme) : null
  const last = usual ? usual.ref : opts.last
  const known = last.length > 0
  const working = usual ? usual.working : known ? Math.min(8, Math.max(1, workingCount(last) || 1)) : scheme.working

  const cold = coldWarmupCount(opts.warmups, last)
  const warmup = scheme.warmup === 'never' ? 0 : scheme.warmup === 'always' ? Math.max(1, cold) : muscleWarm ? 0 : cold

  const usualDrops = known ? Math.min(3, countOf(last, 'drop')) : 0
  const drop = scheme.drop === 'never' ? 0 : scheme.drop === 'always' ? Math.max(1, usualDrops) : usualDrops

  return [
    ...Array<SetType>(warmup).fill('warmup'),
    ...Array<SetType>(working).fill('working'),
    ...Array<SetType>(drop).fill('drop'),
  ]
}

/** Anteil vom Arbeitsgewicht für den i-ten von n Aufwärmsätzen: einer = 50 %, mehrere steigen 40 % → 75 %. */
export function warmupShare(i: number, n: number): number {
  if (n <= 1) return 0.5
  return Math.round((0.4 + (0.35 * i) / (n - 1)) * 100) / 100
}

/** Übliche Zahl aus einer Liste (neueste zuerst): die letzten zwei gleich → die; sonst die häufigste. */
function usualNumber(list: readonly number[]): number | null {
  if (!list.length) return null
  if (list.length === 1 || list[0] === list[1]) return list[0]
  const freq = new Map<number, number>()
  for (const n of list) freq.set(n, (freq.get(n) ?? 0) + 1)
  // Gleichstand → die neuere
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || list.indexOf(a[0]) - list.indexOf(b[0]))[0][0]
}

export interface PastSet {
  date: string
  exercise_id: string
  set_type?: SetType | null
  created_at: string
}

/**
 * Aufwärm-Gewohnheit aus dem Verlauf: Für jedes Training wird die Reihenfolge der Übungen
 * (erster Satz) nachgebaut. War die Muskelgruppe einer Übung da noch kalt (keine frühere Übung mit
 * der Gruppe als Haupt- oder Nebenmuskel), zählt ihre Anzahl Aufwärmsätze. Nur ausgeführte Sätze
 * übergeben. Liefert die Gewohnheit je Übung, sonst je Muskelgruppe, sonst der ersten Übung eines Trainings.
 */
export function warmupHabit(
  sets: readonly PastSet[],
  muscles: (exId: string) => { group: string; secondary: readonly string[] } | undefined,
): { forExercise: (exId: string) => WarmupHistory } {
  const byDate = new Map<string, PastSet[]>()
  for (const s of sets) {
    const l = byDate.get(s.date)
    if (l) l.push(s)
    else byDate.set(s.date, [s])
  }
  const perEx = new Map<string, number[]>()
  const perGroup = new Map<string, number[]>()
  const firstOfDay: number[] = []
  const push = (m: Map<string, number[]>, k: string, n: number, cap: number) => {
    const l = m.get(k)
    if (!l) m.set(k, [n])
    else if (l.length < cap) l.push(n)
  }
  const dates = [...byDate.keys()].sort().reverse()
  dates.forEach((date) => {
    const day = byDate.get(date)!
    const first = new Map<string, string>()
    const warm = new Map<string, number>()
    for (const s of day) {
      if (!first.has(s.exercise_id) || s.created_at < first.get(s.exercise_id)!) first.set(s.exercise_id, s.created_at)
      if (s.set_type === 'warmup') warm.set(s.exercise_id, (warm.get(s.exercise_id) ?? 0) + 1)
    }
    const order = [...first.entries()].sort((a, b) => (a[1] < b[1] ? -1 : 1)).map(([id]) => id)
    const warmed = new Set<string>()
    order.forEach((id, pos) => {
      const m = muscles(id)
      if (!m) return
      if (!warmed.has(m.group)) {
        const n = warm.get(id) ?? 0
        push(perEx, id, n, 4)
        push(perGroup, m.group, n, 6)
        if (pos === 0 && firstOfDay.length < 8) firstOfDay.push(n)
      }
      warmed.add(m.group)
      for (const g of m.secondary) warmed.add(g)
    })
  })
  const firstHabit = usualNumber(firstOfDay)
  return {
    forExercise: (exId) => {
      // Ohne eigene Erfahrung: wie bei anderen Übungen derselben Muskelgruppe (Latzug ← Rudern), sonst wie
      // bei der ersten Übung eines Trainings. Isolationsübungen ohne Aufwärmen (Butterfly, Bauch) zählen
      // so nicht für den Rücken mit.
      const g = muscles(exId)?.group
      const group = g ? usualNumber(perGroup.get(g) ?? []) : null
      return { exercise: usualNumber(perEx.get(exId) ?? []), habit: group ?? firstHabit }
    },
  }
}

/** Satz-Typen der letzten Einheit einer Übung aus dem Verlauf (Sätze mit Datum). */
export function lastSessionTypes(history: readonly { date: string; set_type?: SetType | null }[]): SetType[] {
  if (history.length === 0) return []
  let lastDate = ''
  for (const s of history) if (s.date > lastDate) lastDate = s.date
  return history.filter((s) => s.date === lastDate).map((s) => s.set_type ?? 'working')
}

/** Satz-Typen der letzten `n` Einheiten einer Übung, neueste zuerst. */
export function recentSessionTypes(
  history: readonly { date: string; set_type?: SetType | null }[],
  n = 4,
): SetType[][] {
  const by = new Map<string, SetType[]>()
  for (const s of history) {
    const list = by.get(s.date)
    const t = s.set_type ?? 'working'
    if (list) list.push(t)
    else by.set(s.date, [t])
  }
  return [...by.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, n)
    .map(([, t]) => t)
}

/** Kurzbeschreibung fürs Profil, z. B. „Aufwärmen · 3 Sätze · Drop“. */
export function describeScheme(s: SetScheme): string {
  const parts = [
    s.warmup === 'never' ? null : s.warmup === 'always' ? 'Aufwärmen' : 'Aufwärmen auto',
    `${s.working} ${s.working === 1 ? 'Satz' : 'Sätze'}`,
    s.drop === 'always' ? 'Drop' : s.drop === 'never' ? 'ohne Drop' : null,
  ]
  return parts.filter(Boolean).join(' · ')
}
