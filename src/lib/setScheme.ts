// Welche Sätze legt das Training für eine Übung an? Nicht jeder trainiert gleich:
//  1. Gibt es die Übung schon im Verlauf, wird die übliche Struktur übernommen (Anzahl Arbeitssätze,
//     Dropsatz ja/nein, Aufwärmen ja/nein). „Üblich“ = aus den letzten Einheiten: ein Ausreißer
//     (z. B. einmal nur 1 Satz geschafft) ändert nichts; zweimal hintereinander gleich = bewusst geändert.
//  2. Neue Übung → eigenes Standard-Schema aus den Einstellungen (Standard: 3 Arbeitssätze,
//     Aufwärmen automatisch, kein Dropsatz).
// Aufwärmen „automatisch“ = nur die erste Übung einer Muskelgruppe im Training.
// Reine Logik – getestet in setScheme.test.ts.

import type { SetType } from '../types'

export type WarmupMode = 'auto' | 'always' | 'never'

export interface SetScheme {
  /** Arbeitssätze für neue Übungen (1–8) */
  working: number
  warmup: WarmupMode
  /** Dropsatz am Ende (neue Übungen) */
  drop: boolean
}

export const DEFAULT_SET_SCHEME: SetScheme = { working: 3, warmup: 'auto', drop: false }

export function normalizeSetScheme(raw: unknown): SetScheme {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const w = Number(r.working)
  return {
    working: Number.isFinite(w) ? Math.min(8, Math.max(1, Math.round(w))) : DEFAULT_SET_SCHEME.working,
    warmup: r.warmup === 'always' || r.warmup === 'never' ? r.warmup : 'auto',
    drop: r.drop === true,
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

export function planSetTypes(opts: {
  scheme: SetScheme
  /** Satz-Typen der letzten Einheit dieser Übung (Reihenfolge egal), leer = neue Übung */
  last: readonly SetType[]
  /** Letzte Einheiten (neueste zuerst) – wenn angegeben, zählt die übliche statt der letzten */
  sessions?: readonly (readonly SetType[])[]
  /** Muskelgruppe heute schon warm (andere Übung derselben Gruppe trainiert) */
  muscleWarm: boolean
}): SetType[] {
  const { scheme, muscleWarm } = opts
  const usual = opts.sessions?.length ? usualSession(opts.sessions, scheme) : null
  const last = usual ? usual.ref : opts.last
  const known = last.length > 0
  const working = usual ? usual.working : known ? Math.min(8, Math.max(1, workingCount(last) || 1)) : scheme.working
  const drop = known ? last.includes('drop') : scheme.drop

  let warmup: boolean
  if (scheme.warmup === 'never') warmup = false
  else if (scheme.warmup === 'always') warmup = true
  // automatisch: nur wenn du bei dieser Übung aufwärmst (bzw. sie neu ist) und der Muskel noch kalt ist
  else warmup = !muscleWarm && (!known || last.includes('warmup'))

  return [
    ...(warmup ? ['warmup' as const] : []),
    ...Array<SetType>(working).fill('working'),
    ...(drop ? ['drop' as const] : []),
  ]
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
    s.drop ? 'Drop' : null,
  ]
  return parts.filter(Boolean).join(' · ')
}
