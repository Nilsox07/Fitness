/**
 * „Mit Standard-Übungen starten": Ziel-Vorlagen aus der Übungsbibliothek.
 * Legt gängige Übungen (verknüpft mit der Bibliothek → Animation) und auf
 * Wunsch passende Pläne an. Bereits vorhandene Übungen/Pläne werden erkannt
 * und nicht doppelt angelegt.
 */
import type { ExerciseInput } from '../hooks/useExercises'
import {
  findLibraryMatch,
  libraryToExerciseInput,
  normalize,
  type LibraryExercise,
  type LibraryLinks,
} from './exerciseLibrary'

export type StarterId = 'fullbody' | 'ppl' | 'upperlower'

/** Übung einer Vorlage: Bibliotheks-ID + kurzer, gewohnter deutscher Name. */
interface StarterExercise {
  lib: string
  name: string
  reps?: [number, number]
}

export interface StarterTemplate {
  id: StarterId
  title: string
  desc: string
  days: string
  plans: { name: string; exercises: StarterExercise[] }[]
}

const E = {
  bench: { lib: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Bankdrücken', reps: [6, 10] },
  incline: { lib: 'Incline_Dumbbell_Press', name: 'Schrägbankdrücken (Kurzhantel)', reps: [8, 12] },
  ohp: { lib: 'Dumbbell_Shoulder_Press', name: 'Schulterdrücken (Kurzhantel)', reps: [8, 12] },
  lateral: { lib: 'Side_Lateral_Raise', name: 'Seitheben', reps: [12, 15] },
  pushdown: { lib: 'Triceps_Pushdown', name: 'Trizepsdrücken am Kabel', reps: [10, 15] },
  fly: { lib: 'Butterfly', name: 'Butterfly', reps: [10, 15] },
  pulldown: { lib: 'Wide-Grip_Lat_Pulldown', name: 'Latzug', reps: [8, 12] },
  row: { lib: 'Seated_Cable_Rows', name: 'Rudern am Kabel', reps: [8, 12] },
  facepull: { lib: 'Face_Pull', name: 'Face Pulls', reps: [12, 15] },
  curl: { lib: 'Dumbbell_Bicep_Curl', name: 'Bizepscurls', reps: [10, 12] },
  hammer: { lib: 'Hammer_Curls', name: 'Hammercurls', reps: [10, 12] },
  squat: { lib: 'Barbell_Squat', name: 'Kniebeuge', reps: [6, 10] },
  rdl: { lib: 'Romanian_Deadlift', name: 'Rumänisches Kreuzheben', reps: [8, 10] },
  legpress: { lib: 'Leg_Press', name: 'Beinpresse', reps: [10, 12] },
  legcurl: { lib: 'Lying_Leg_Curls', name: 'Beinbeuger', reps: [10, 15] },
  legext: { lib: 'Leg_Extensions', name: 'Beinstrecker', reps: [10, 15] },
  calf: { lib: 'Standing_Calf_Raises', name: 'Wadenheben', reps: [12, 15] },
  crunch: { lib: 'Crunches', name: 'Crunches', reps: [12, 20] },
} satisfies Record<string, StarterExercise & { reps: [number, number] }>

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'fullbody',
    title: 'Ganzkörper',
    desc: 'Zwei Pläne im Wechsel, ideal für Einsteiger',
    days: '2–3× pro Woche',
    plans: [
      { name: 'Ganzkörper A', exercises: [E.squat, E.bench, E.row, E.ohp, E.legcurl, E.crunch] },
      { name: 'Ganzkörper B', exercises: [E.rdl, E.incline, E.pulldown, E.legpress, E.lateral, E.curl, E.pushdown] },
    ],
  },
  {
    id: 'ppl',
    title: 'Push · Pull · Beine',
    desc: 'Drücken, Ziehen und Beine an getrennten Tagen',
    days: '3–6× pro Woche',
    plans: [
      { name: 'Push', exercises: [E.bench, E.incline, E.ohp, E.lateral, E.pushdown] },
      { name: 'Pull', exercises: [E.pulldown, E.row, E.facepull, E.curl, E.hammer] },
      { name: 'Beine', exercises: [E.squat, E.legpress, E.rdl, E.legcurl, E.calf] },
    ],
  },
  {
    id: 'upperlower',
    title: 'Oberkörper · Unterkörper',
    desc: 'Zwei Schwerpunkte im Wechsel',
    days: '4× pro Woche',
    plans: [
      { name: 'Oberkörper', exercises: [E.bench, E.row, E.ohp, E.pulldown, E.curl, E.pushdown] },
      { name: 'Unterkörper', exercises: [E.squat, E.rdl, E.legpress, E.legcurl, E.calf, E.crunch] },
    ],
  },
]

/** Alle Übungen einer Vorlage (eindeutig, Reihenfolge des ersten Auftretens). */
export function starterExercises(t: StarterTemplate): StarterExercise[] {
  const seen = new Set<string>()
  const out: StarterExercise[] = []
  for (const p of t.plans)
    for (const e of p.exercises) {
      if (seen.has(e.lib)) continue
      seen.add(e.lib)
      out.push(e)
    }
  return out
}

export interface StarterPlan {
  /** Neu anzulegende Übungen (mit Bibliotheks-ID für die Verknüpfung). */
  create: { lib: string; input: ExerciseInput }[]
  /** Bibliotheks-ID → vorhandene eigene Übung (wird wiederverwendet). */
  existing: Map<string, string>
  /** Pläne (Name + Bibliotheks-IDs in Reihenfolge); `exists` = Plan gleichen Namens vorhanden. */
  plans: { name: string; libs: string[]; exists: boolean }[]
}

/**
 * Was beim Übernehmen einer Vorlage passiert. Vorhanden heißt: gleicher Name
 * (normalisiert) oder bereits mit demselben Bibliotheks-Eintrag verknüpft/abgeglichen.
 */
export function planStarter(
  t: StarterTemplate,
  mine: { id: string; name: string }[],
  planNames: string[],
  list: LibraryExercise[],
  links: LibraryLinks = {},
): StarterPlan {
  const byLib = new Map(list.map((e) => [e.id, e]))
  const existing = new Map<string, string>()
  const mineByName = new Map(mine.map((m) => [normalize(m.name), m.id]))
  const mineByLib = new Map<string, string>()
  for (const m of mine) {
    const hit = findLibraryMatch(m, list, links)
    if (hit && !mineByLib.has(hit.id)) mineByLib.set(hit.id, m.id)
  }

  const create: StarterPlan['create'] = []
  for (const e of starterExercises(t)) {
    const item = byLib.get(e.lib)
    const own = mineByName.get(normalize(e.name)) ?? mineByLib.get(e.lib)
    if (own) {
      existing.set(e.lib, own)
      continue
    }
    if (!item) continue
    const base = libraryToExerciseInput(item)
    create.push({
      lib: e.lib,
      input: {
        ...base,
        name: e.name,
        target_rep_min: e.reps?.[0] ?? base.target_rep_min,
        target_rep_max: e.reps?.[1] ?? base.target_rep_max,
      },
    })
  }

  const known = new Set(planNames.map(normalize))
  const available = new Set([...existing.keys(), ...create.map((c) => c.lib)])
  return {
    create,
    existing,
    plans: t.plans.map((p) => ({
      name: p.name,
      libs: p.exercises.map((e) => e.lib).filter((id) => available.has(id)),
      exists: known.has(normalize(p.name)),
    })),
  }
}
