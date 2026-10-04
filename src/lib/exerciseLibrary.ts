/**
 * Eingebaute Übungsbibliothek (Daten & Bilder: free-exercise-db, Public Domain).
 *
 * Die Daten liegen als statische Datei unter /exercise-library.json (gebaut von
 * scripts/build-exercise-library.mjs) und werden erst bei Bedarf geladen — nicht
 * gebundelt. Ergebnis wird im Speicher und (für offline) im Cache Storage gehalten.
 *
 * Verknüpfung eigener Übungen mit der Bibliothek ohne DB-Änderung:
 * localStorage `exercise_library_links` = { [userExerciseId]: libraryId },
 * Fallback: Abgleich über den Namen.
 */
import type { ExerciseInput } from '../hooks/useExercises'
import { MUSCLE_GROUPS, type MuscleGroup } from '../types'

export type LibraryLevel = 'Anfänger' | 'Fortgeschritten' | 'Profi'
export type LibraryMechanic = 'Grundübung' | 'Isolation'

export interface LibraryExercise {
  id: string
  name_de: string
  name_en: string
  muscle: MuscleGroup
  secondary: MuscleGroup[]
  equipment: string
  level: LibraryLevel
  mechanic: LibraryMechanic
  category: string
  /** Relative Pfade der beiden Animations-Frames (z. B. "Barbell_Squat/0.jpg"). */
  images: string[]
  steps_de: string[]
  /** Für Training zu Hause geeignet (Körpergewicht, Band, Kurzhantel, Kettlebell …). */
  home: boolean
}

interface LibraryFile {
  version: number
  imageBase?: string
  exercises: LibraryExercise[]
}

export const LIBRARY_URL = '/exercise-library.json'
export const IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'
export const LIBRARY_ATTRIBUTION = 'Übungsdaten & Bilder: free-exercise-db (Public Domain)'

const CACHE_NAME = 'exercise-library-v1'
export const LINKS_KEY = 'exercise_library_links'

/** Reihenfolge der Equipment-Filter-Chips. */
export const LIBRARY_EQUIPMENT = [
  'Körpergewicht',
  'Kurzhantel',
  'Langhantel',
  'SZ-Stange',
  'Kabelzug',
  'Maschine',
  'Kettlebell',
  'Band',
  'Medizinball',
  'Gymnastikball',
  'Sonstiges',
] as const

export function imageUrl(path: string): string {
  return IMAGE_BASE + path
}

// ---------------------------------------------------------------------------
// Laden & Cache
// ---------------------------------------------------------------------------

let memory: LibraryExercise[] | null = null
let inflight: Promise<LibraryExercise[]> | null = null

/** Bereits geladene Bibliothek (synchron), sonst null. */
export function peekLibrary(): LibraryExercise[] | null {
  return memory
}

function parse(data: LibraryFile): LibraryExercise[] {
  if (!Array.isArray(data?.exercises)) throw new Error('Bibliothek hat ein unbekanntes Format')
  return data.exercises
}

/**
 * Netzwerk zuerst, Kopie im Cache Storage für offline (bewusst nicht im
 * localStorage — der ist für den Query-Cache der App reserviert und zu klein).
 */
async function fetchLibrary(): Promise<LibraryExercise[]> {
  const cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NAME).catch(() => null) : null
  try {
    const res = await fetch(LIBRARY_URL)
    if (!res.ok) throw new Error(`Bibliothek konnte nicht geladen werden (${res.status})`)
    const list = parse((await res.clone().json()) as LibraryFile)
    cache?.put(LIBRARY_URL, res).catch(() => {})
    return list
  } catch (err) {
    const hit = await cache?.match(LIBRARY_URL).catch(() => undefined)
    if (hit) return parse((await hit.json()) as LibraryFile)
    throw err instanceof Error ? err : new Error('Bibliothek nicht verfügbar')
  }
}

/** Lädt die Bibliothek (einmal pro Sitzung; parallele Aufrufe teilen sich den Request). */
export function loadLibrary(): Promise<LibraryExercise[]> {
  if (memory) return Promise.resolve(memory)
  if (inflight) return inflight
  inflight = fetchLibrary()
    .then((list) => {
      memory = list
      return list
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

// ---------------------------------------------------------------------------
// Suche & Filter
// ---------------------------------------------------------------------------

/** Kleinschreibung, Umlaute/Akzente vereinheitlicht, Satzzeichen → Leerzeichen. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export interface LibraryFilter {
  query?: string
  muscle?: MuscleGroup | null
  equipment?: string | null
  home?: boolean
}

/**
 * Filtert und sortiert: alle Suchwörter müssen im deutschen oder englischen
 * Namen (bzw. Muskel/Equipment) vorkommen. Treffer am Namensanfang zuerst.
 */
export function searchLibrary(list: LibraryExercise[], f: LibraryFilter = {}): LibraryExercise[] {
  const q = normalize(f.query ?? '')
  const words = q ? q.split(' ') : []
  const out: { ex: LibraryExercise; score: number }[] = []
  for (const ex of list) {
    if (f.muscle && ex.muscle !== f.muscle) continue
    if (f.equipment && ex.equipment !== f.equipment) continue
    if (f.home && !ex.home) continue
    if (words.length === 0) {
      out.push({ ex, score: 0 })
      continue
    }
    const de = normalize(ex.name_de)
    const en = normalize(ex.name_en)
    const extra = normalize(`${ex.muscle} ${ex.secondary.join(' ')} ${ex.equipment}`)
    const hay = `${de} ${en} ${extra}`
    if (!words.every((w) => hay.includes(w))) continue
    let score = 3
    if (de.startsWith(q) || en.startsWith(q)) score = 0
    else if (de.includes(q) || en.includes(q)) score = 1
    else if (words.every((w) => de.includes(w) || en.includes(w))) score = 2
    out.push({ ex, score })
  }
  return out
    .sort((a, b) => a.score - b.score || a.ex.name_de.localeCompare(b.ex.name_de, 'de'))
    .map((x) => x.ex)
}

/** Muskelgruppen in der Reihenfolge von MUSCLE_GROUPS, die in der Liste vorkommen. */
export function libraryMuscles(list: LibraryExercise[]): MuscleGroup[] {
  const used = new Set(list.map((e) => e.muscle))
  return MUSCLE_GROUPS.filter((m) => used.has(m) && m !== 'Sonstige')
}

// ---------------------------------------------------------------------------
// Verknüpfung eigene Übung ↔ Bibliothek
// ---------------------------------------------------------------------------

export type LibraryLinks = Record<string, string>

export function getLinks(): LibraryLinks {
  try {
    const raw = localStorage.getItem(LINKS_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as LibraryLinks) : {}
  } catch {
    return {}
  }
}

export function setLink(userExerciseId: string, libraryId: string) {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify({ ...getLinks(), [userExerciseId]: libraryId }))
  } catch {
    /* ignore */
  }
}

export function removeLink(userExerciseId: string) {
  try {
    const links = getLinks()
    delete links[userExerciseId]
    localStorage.setItem(LINKS_KEY, JSON.stringify(links))
  } catch {
    /* ignore */
  }
}

/** Gängige Kurznamen → Bibliotheks-ID (für den Namensabgleich). */
const ALIASES: Record<string, string> = {
  bankdrucken: 'Barbell_Bench_Press_-_Medium_Grip',
  kreuzheben: 'Barbell_Deadlift',
  kniebeuge: 'Barbell_Squat',
  kniebeugen: 'Barbell_Squat',
  squat: 'Barbell_Squat',
  squats: 'Barbell_Squat',
  latzug: 'Wide-Grip_Lat_Pulldown',
  'lat pulldown': 'Wide-Grip_Lat_Pulldown',
  klimmzug: 'Pullups',
  klimmzuge: 'Pullups',
  'pull ups': 'Pullups',
  liegestutz: 'Pushups',
  liegestutze: 'Pushups',
  'push ups': 'Pushups',
  schulterdrucken: 'Dumbbell_Shoulder_Press',
  'military press': 'Standing_Military_Press',
  rudern: 'Seated_Cable_Rows',
  kabelrudern: 'Seated_Cable_Rows',
  langhantelrudern: 'Bent_Over_Barbell_Row',
  seitheben: 'Side_Lateral_Raise',
  bizepscurls: 'Dumbbell_Bicep_Curl',
  bizepscurl: 'Dumbbell_Bicep_Curl',
  'bizeps curls': 'Dumbbell_Bicep_Curl',
  trizepsdrucken: 'Triceps_Pushdown',
  'trizeps drucken': 'Triceps_Pushdown',
  beinstrecker: 'Leg_Extensions',
  beinbeuger: 'Lying_Leg_Curls',
  wadenheben: 'Standing_Calf_Raises',
  'hip thrust': 'Barbell_Hip_Thrust',
  'hip thrusts': 'Barbell_Hip_Thrust',
  dips: 'Dips_-_Triceps_Version',
  plank: 'Plank',
  crunch: 'Crunches',
  ausfallschritte: 'Dumbbell_Lunges',
  'rumanisches kreuzheben': 'Romanian_Deadlift',
  rdl: 'Romanian_Deadlift',
  'face pull': 'Face_Pull',
  'face pulls': 'Face_Pull',
}

/** Name ohne Klammerzusatz: „Bankdrücken (Langhantel)" → „bankdrucken". */
function baseName(s: string): string {
  return normalize(s.replace(/\([^)]*\)/g, ' '))
}

/** Bei mehreren gleich guten Treffern: klassisches Gym-Equipment bevorzugen. */
const EQUIP_RANK: Record<string, number> = {
  Langhantel: 0,
  Kurzhantel: 1,
  Maschine: 2,
  Kabelzug: 3,
  Körpergewicht: 4,
}

/**
 * Bibliotheks-Eintrag zu einer eigenen Übung: zuerst gespeicherte Verknüpfung,
 * dann exakter Namensabgleich (deutsch/englisch), dann Kurzname/Alias.
 */
export function findLibraryMatch(
  exercise: { id: string; name: string },
  list: LibraryExercise[],
  links: LibraryLinks = getLinks(),
): LibraryExercise | null {
  const byId = (id: string | undefined) => (id ? list.find((e) => e.id === id) ?? null : null)
  const linked = byId(links[exercise.id])
  if (linked) return linked

  const n = normalize(exercise.name)
  if (!n) return null
  const exact = list.find((e) => normalize(e.name_de) === n || normalize(e.name_en) === n)
  if (exact) return exact

  const alias = byId(ALIASES[n])
  if (alias) return alias

  const b = baseName(exercise.name)
  const close = list
    .filter((e) => baseName(e.name_de) === b)
    .sort((x, y) => (EQUIP_RANK[x.equipment] ?? 9) - (EQUIP_RANK[y.equipment] ?? 9))
  return close[0] ?? byId(ALIASES[b])
}

// ---------------------------------------------------------------------------
// Übernahme in die eigenen Übungen
// ---------------------------------------------------------------------------

/** Grundübung 6–10, Isolation 10–15 Wiederholungen. */
export function repRangeFor(ex: Pick<LibraryExercise, 'mechanic'>): [number, number] {
  return ex.mechanic === 'Isolation' ? [10, 15] : [6, 10]
}

const UNILATERAL = /\b(einarmig|einbeinig)/i

export function libraryToExerciseInput(ex: LibraryExercise): ExerciseInput {
  const [min, max] = repRangeFor(ex)
  const muscle = (MUSCLE_GROUPS as readonly string[]).includes(ex.muscle) ? ex.muscle : 'Sonstige'
  const light = ['Kurzhantel', 'Kettlebell', 'Band', 'Körpergewicht', 'Medizinball', 'Gymnastikball']
  return {
    name: ex.name_de,
    muscle_group: muscle,
    notes: null,
    target_rep_min: min,
    target_rep_max: max,
    increment: light.includes(ex.equipment) ? 1 : 2.5,
    unilateral: UNILATERAL.test(ex.name_de),
    weight_steps: null,
    secondary_muscles: ex.secondary.filter((m) => m !== muscle),
  }
}
