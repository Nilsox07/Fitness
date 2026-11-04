// Vorermüdung: Wer erst Schrägbankdrücken und dann Butterfly macht, schafft beim Butterfly weniger
// als ausgeruht. Gezählt werden die harten Sätze (ohne Aufwärmen) anderer Übungen VOR dieser Übung
// am selben Tag, die denselben Muskel treffen: gleicher Hauptmuskel = 1, nur als Hilfsmuskel = 0,5.
// Daraus ein vorsichtiger Leistungsfaktor (Schätzwert): je Satz −1,5 %, höchstens −15 %.
// Reine Logik – getestet in fatigue.test.ts.

export interface MuscleInfo {
  muscle_group: string
  secondary_muscles?: string[] | null
}

interface DaySet {
  exercise_id: string
  created_at: string
  set_type: string
  reps: number
  reps_right?: number | null
}

export const FATIGUE_PER_SET = 0.015
export const FATIGUE_MAX = 0.15
/** Ab diesem Unterschied (Faktor) passt die App den Vorschlag an. */
export const FATIGUE_NOTICE = 0.05

/** Wie stark belastet Übung `before` den Zielmuskel von `target`? */
export function overlap(target: MuscleInfo, before: MuscleInfo): number {
  if (before.muscle_group === target.muscle_group) return 1
  if ((target.secondary_muscles ?? []).includes(before.muscle_group)) return 0.5
  if ((before.secondary_muscles ?? []).includes(target.muscle_group)) return 0.5
  return 0
}

const performed = (s: DaySet) => s.reps > 0 || (s.reps_right ?? 0) > 0

/**
 * Vorermüdungs-Sätze für eine Übung an einem Tag. Startzeit der Übung = ihr erster Satz;
 * gibt es noch keinen (z. B. gerade erst ausgewählt), zählt alles bisher Erledigte.
 */
export function preFatigueSets(
  daySets: readonly DaySet[],
  exerciseId: string,
  muscles: Map<string, MuscleInfo>,
): number {
  const target = muscles.get(exerciseId)
  if (!target) return 0
  const own = daySets.filter((s) => s.exercise_id === exerciseId).map((s) => s.created_at)
  const start = own.length ? own.reduce((a, b) => (a < b ? a : b)) : '9999'
  let n = 0
  for (const s of daySets) {
    if (s.exercise_id === exerciseId || s.set_type === 'warmup' || !performed(s) || s.created_at >= start) continue
    const m = muscles.get(s.exercise_id)
    if (m) n += overlap(target, m) * (s.set_type === 'drop' ? 0.5 : 1)
  }
  return Math.round(n * 2) / 2
}

/** Leistungsfaktor (1 = ausgeruht). */
export function fatigueFactor(sets: number): number {
  return Math.max(1 - FATIGUE_MAX, 1 - FATIGUE_PER_SET * Math.max(0, sets))
}

/** Vorermüdung dieser Übung je Trainingstag (für Verlauf und Statistik). */
export function fatigueByDate(
  allSets: readonly (DaySet & { date: string })[],
  exerciseId: string,
  muscles: Map<string, MuscleInfo>,
): Map<string, number> {
  const byDate = new Map<string, (DaySet & { date: string })[]>()
  const dates = new Set<string>()
  for (const s of allSets) {
    if (s.exercise_id === exerciseId) dates.add(s.date)
  }
  for (const s of allSets) {
    if (!dates.has(s.date)) continue
    const list = byDate.get(s.date) ?? []
    list.push(s)
    byDate.set(s.date, list)
  }
  const out = new Map<string, number>()
  for (const [d, list] of byDate) out.set(d, preFatigueSets(list, exerciseId, muscles))
  return out
}

/** Muskel-Karte aus der Übungsliste. */
export function muscleMap(exercises: readonly ({ id: string } & MuscleInfo)[]): Map<string, MuscleInfo> {
  return new Map(exercises.map((e) => [e.id, { muscle_group: e.muscle_group, secondary_muscles: e.secondary_muscles }]))
}
