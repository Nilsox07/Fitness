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

// Änderungen an den Verknüpfungen melden (z. B. Thumbnails/Detailseite neu berechnen).
const linkListeners = new Set<() => void>()
let linksVersion = 0

/** Zähler, der sich bei jeder gespeicherten Verknüpfung erhöht. */
export function getLinksVersion(): number {
  return linksVersion
}

export function subscribeLinks(fn: () => void): () => void {
  linkListeners.add(fn)
  return () => {
    linkListeners.delete(fn)
  }
}

function notifyLinks() {
  linksVersion++
  for (const fn of linkListeners) fn()
}

export function setLink(userExerciseId: string, libraryId: string) {
  setLinks({ [userExerciseId]: libraryId })
}

/** Mehrere Verknüpfungen auf einmal speichern (ein Schreibvorgang, eine Meldung). */
export function setLinks(patch: LibraryLinks) {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify({ ...getLinks(), ...patch }))
  } catch {
    /* ignore */
  }
  notifyLinks()
}

export function removeLink(userExerciseId: string) {
  try {
    const links = getLinks()
    delete links[userExerciseId]
    localStorage.setItem(LINKS_KEY, JSON.stringify(links))
  } catch {
    /* ignore */
  }
  notifyLinks()
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
// Unscharfe Zuordnungs-Vorschläge (eigene Übung → Bibliothek)
// ---------------------------------------------------------------------------

/**
 * Synonym-Gruppen (bereits normalisiert). Deutsche Begriffe ab 6 Zeichen
 * passen auch mitten in Komposita („Kurzhantelrudern"), kurze/englische nur
 * am Wortanfang („row" ≠ „throw").
 */
const CONCEPTS: Record<string, string[]> = {
  bench: ['bankdrucken', 'bench press', 'brustdrucken', 'brustpresse', 'chest press'],
  incline: ['schragbank', 'incline'],
  decline: ['negativbank', 'decline'],
  pulldown: ['latzug', 'latziehen', 'lat pulldown', 'pulldown', 'pull down'],
  row: ['rudern', 'row', 'rows'],
  squat: ['kniebeuge', 'squat', 'squats'],
  deadlift: ['kreuzheben', 'deadlift'],
  ohp: ['schulterdrucken', 'nackendrucken', 'shoulder press', 'military press', 'overhead press'],
  legpress: ['beinpresse', 'leg press'],
  legext: ['beinstrecker', 'beinstrecken', 'leg extension'],
  legcurl: ['beinbeuger', 'beinbeugen', 'leg curl'],
  fly: ['butterfly', 'pec deck', 'fly', 'flys', 'flyes', 'fliegende', 'crossover'],
  pecdeck: ['butterfly', 'pec deck', 'peck deck'],
  pushdown: ['trizepsdrucken', 'pushdown', 'push down', 'pressdown'],
  curl: ['curl', 'curls', 'bizepscurl', 'hammercurl'],
  lateral: ['seitheben', 'seitenheben', 'lateral raise'],
  calf: ['wadenheben', 'waden', 'calf'],
  hipthrust: ['hip thrust', 'hipthrust', 'huftheben', 'glute bridge'],
  lunge: ['ausfallschritt', 'lunge', 'lunges'],
  dips: ['dips', 'dip'],
  pullup: ['klimmzug', 'klimmzuge', 'pullup', 'pullups', 'pull up', 'chin up', 'chinup'],
  facepull: ['face pull'],
  crunch: ['crunch', 'crunches'],
  plank: ['plank', 'unterarmstutz'],
  pushup: ['liegestutz', 'pushup', 'pushups', 'push up'],
  shrug: ['shrug', 'shrugs', 'schulterheben'],
  reverse: ['reverse'],
  upright: ['aufrecht', 'upright'],
  oneside: ['einarmig', 'einbeinig', 'one arm', 'single leg', 'one leg'],
  hammer: ['hammer'],
  romanian: ['rumanisch', 'romanian', 'rdl'],
  extension: ['extension', 'strecken'],
}

/** Equipment-Hinweise im Namen → Equipment der Bibliothek. */
const EQUIP_CONCEPTS: Record<string, string[]> = {
  Langhantel: ['langhantel', 'barbell'],
  Kurzhantel: ['kurzhantel', 'dumbbell', 'kh'],
  Kabelzug: ['kabelzug', 'kabel', 'cable', 'seilzug'],
  Maschine: ['maschine', 'machine', 'gerat'],
  'SZ-Stange': ['sz', 'ez bar', 'ez'],
  Kettlebell: ['kettlebell'],
  Körpergewicht: ['korpergewicht', 'bodyweight'],
  Band: ['band', 'theraband'],
}

const STOP = new Set([
  'mit', 'am', 'an', 'auf', 'der', 'die', 'das', 'den', 'und', 'fur', 'im', 'in', 'zur', 'zum', 'von',
  'the', 'with', 'on', 'to', 'of', 'and', 'a',
  // Equipment zählt separat (sonst wären reine Equipment-Treffer Vorschläge)
  'langhantel', 'kurzhantel', 'kabelzug', 'kabel', 'maschine', 'barbell', 'dumbbell', 'cable', 'machine',
])

function hasTerm(text: string, term: string): boolean {
  return (' ' + text).includes(' ' + term) || (term.length >= 6 && !term.includes(' ') && text.includes(term))
}

function conceptsOf(text: string): Set<string> {
  const out = new Set<string>()
  for (const [k, terms] of Object.entries(CONCEPTS)) if (terms.some((t) => hasTerm(text, t))) out.add(k)
  return out
}

function equipOf(text: string): string | null {
  for (const [eq, terms] of Object.entries(EQUIP_CONCEPTS)) {
    if (terms.some((t) => (' ' + text + ' ').includes(' ' + t + ' ') || (t.length >= 6 && text.includes(t)))) return eq
  }
  return null
}

function tokensOf(text: string): string[] {
  return text.split(' ').filter((t) => t.length >= 3 && !STOP.has(t))
}

interface Features {
  text: string
  tokens: string[]
  concepts: Set<string>
}

const featureCache = new WeakMap<LibraryExercise[], Map<string, Features>>()

function featuresFor(list: LibraryExercise[]): Map<string, Features> {
  let map = featureCache.get(list)
  if (!map) {
    map = new Map()
    for (const ex of list) {
      const text = `${normalize(ex.name_de)} ${normalize(ex.name_en)}`
      map.set(ex.id, { text, tokens: tokensOf(text), concepts: conceptsOf(text) })
    }
    featureCache.set(list, map)
  }
  return map
}

/**
 * Bis zu `n` Bibliotheks-Vorschläge für eine eigene Übung (beste zuerst):
 * gemeinsame Begriffe inkl. Synonymen (Bankdrücken ↔ Bench Press …),
 * Wortüberlappung deutsch/englisch, gleiche Muskelgruppe und passendes
 * Equipment werden bevorzugt. Ohne inhaltlichen Treffer → leere Liste.
 */
export function suggestLinks(
  name: string,
  muscle: MuscleGroup | string | null | undefined,
  list: LibraryExercise[],
  n = 3,
): LibraryExercise[] {
  const q = normalize(name)
  if (!q || list.length === 0) return []
  const qBase = baseName(name)
  const qConcepts = conceptsOf(q)
  const qTokens = tokensOf(q)
  const qEquip = equipOf(q)
  const direct = findLibraryMatch({ id: '', name }, list, {})
  const feats = featuresFor(list)

  const scored: { ex: LibraryExercise; score: number }[] = []
  for (const ex of list) {
    const f = feats.get(ex.id)!
    let shared = 0
    for (const c of qConcepts) if (f.concepts.has(c)) shared++
    let overlap = 0
    for (const t of qTokens) {
      if (f.tokens.some((u) => u === t || (t.length >= 5 && u.length >= 5 && (u.includes(t) || t.includes(u))))) overlap++
    }
    const isDirect = direct?.id === ex.id
    if (!isDirect && shared === 0 && overlap === 0) continue

    let score = shared * 3 + overlap
    if (isDirect) score += 100
    if (normalize(ex.name_de) === q || baseName(ex.name_de) === qBase) score += 5
    // Zusatzbegriffe des Kandidaten, die im Namen fehlen (z. B. „Schrägbank")
    let extra = 0
    for (const c of f.concepts) if (!qConcepts.has(c)) extra++
    score -= Math.min(extra, 3) * 0.75
    if (muscle && ex.muscle === muscle) score += 1.5
    else if (muscle && (ex.secondary as string[]).includes(muscle)) score += 0.4
    if (qEquip) score += ex.equipment === qEquip ? 2.5 : -1.5
    // Ohne Equipment-Angabe: klassisches Gym-Equipment leicht bevorzugen
    else score += Math.max(0, 4 - (EQUIP_RANK[ex.equipment] ?? 4)) * 0.1
    // Kürzere, „klassischere" Namen leicht bevorzugen
    score -= Math.max(0, f.tokens.length - qTokens.length) * 0.05
    if (score <= 0.5) continue
    scored.push({ ex, score })
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        (EQUIP_RANK[a.ex.equipment] ?? 9) - (EQUIP_RANK[b.ex.equipment] ?? 9) ||
        a.ex.name_de.length - b.ex.name_de.length,
    )
    .slice(0, n)
    .map((s) => s.ex)
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
