// Welche Sätze legt das Training für eine Übung an? Nicht jeder trainiert gleich:
//  1. Gibt es die Übung schon im Verlauf, wird die Struktur vom letzten Mal übernommen
//     (Anzahl Arbeitssätze, Dropsatz ja/nein, Aufwärmen ja/nein) – wie bei Strong/Hevy.
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

export function planSetTypes(opts: {
  scheme: SetScheme
  /** Satz-Typen der letzten Einheit dieser Übung (Reihenfolge egal), leer = neue Übung */
  last: readonly SetType[]
  /** Muskelgruppe heute schon warm (andere Übung derselben Gruppe trainiert) */
  muscleWarm: boolean
}): SetType[] {
  const { scheme, last, muscleWarm } = opts
  const known = last.length > 0
  const working = known ? Math.min(8, Math.max(1, last.filter((t) => t === 'working').length || 1)) : scheme.working
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

/** Kurzbeschreibung fürs Profil, z. B. „Aufwärmen · 3 Sätze · Drop“. */
export function describeScheme(s: SetScheme): string {
  const parts = [
    s.warmup === 'never' ? null : s.warmup === 'always' ? 'Aufwärmen' : 'Aufwärmen auto',
    `${s.working} ${s.working === 1 ? 'Satz' : 'Sätze'}`,
    s.drop ? 'Drop' : null,
  ]
  return parts.filter(Boolean).join(' · ')
}
