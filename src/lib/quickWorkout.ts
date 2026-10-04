/**
 * Schnell-Workouts: Intervall-Training für zu Hause aus der Übungsbibliothek.
 *
 * Reine Logik (ohne React): Auswahl der Stationen (deterministisch per Seed,
 * damit „Neu mischen" einfach einen neuen Seed setzt), Runden-/Stationszahl
 * passend zur gewünschten Dauer und die geordnete Intervall-Liste für den Player.
 */
import type { LibraryExercise } from './exerciseLibrary'
import type { MuscleGroup } from '../types'

// ---------------------------------------------------------------------------
// Konfiguration
// ---------------------------------------------------------------------------

export type QuickEquipment = 'none' | 'dumbbell' | 'band' | 'kettlebell'
export type QuickFocus = 'full' | 'upper' | 'lower' | 'core' | 'cardio'
export type QuickIntensity = 'easy' | 'normal' | 'hard'

export const QUICK_MINUTES = [5, 10, 15, 20, 30] as const

export const EQUIPMENT_OPTIONS: { id: QuickEquipment; label: string; library: string }[] = [
  { id: 'none', label: 'Keine (Körpergewicht)', library: 'Körpergewicht' },
  { id: 'dumbbell', label: 'Kurzhanteln', library: 'Kurzhantel' },
  { id: 'band', label: 'Widerstandsband', library: 'Band' },
  { id: 'kettlebell', label: 'Kettlebell', library: 'Kettlebell' },
]

export const FOCUS_OPTIONS: { id: QuickFocus; label: string }[] = [
  { id: 'full', label: 'Ganzkörper' },
  { id: 'upper', label: 'Oberkörper' },
  { id: 'lower', label: 'Beine & Po' },
  { id: 'core', label: 'Bauch' },
  { id: 'cardio', label: 'Cardio-Kick' },
]

export const INTENSITY_OPTIONS: { id: QuickIntensity; label: string; work: number; rest: number }[] = [
  { id: 'easy', label: 'Locker', work: 30, rest: 30 },
  { id: 'normal', label: 'Normal', work: 40, rest: 20 },
  { id: 'hard', label: 'Hart', work: 45, rest: 15 },
]

export const WARMUP_SECONDS = 30
export const ROUND_REST_SECONDS = 60

export interface QuickConfig {
  minutes: number
  equipment: QuickEquipment[]
  focus: QuickFocus
  intensity: QuickIntensity
  seed: number
  /** Vorgaben überschreiben die Berechnung (z. B. 7-Minuten-Klassiker). */
  work?: number
  rest?: number
  stations?: number
  rounds?: number
  warmup?: boolean
}

export interface QuickPreset {
  id: string
  title: string
  subtitle: string
  config: Omit<QuickConfig, 'seed'>
}

export const QUICK_PRESETS: QuickPreset[] = [
  {
    id: 'classic7',
    title: '7-Minuten-Klassiker',
    subtitle: '12 Übungen · 30/10 s',
    config: {
      minutes: 7,
      equipment: ['none'],
      focus: 'full',
      intensity: 'hard',
      work: 30,
      rest: 10,
      stations: 12,
      rounds: 1,
      warmup: false,
    },
  },
  {
    id: 'core10',
    title: 'Bauch 10',
    subtitle: 'Core-Zirkel · 10 Min',
    config: { minutes: 10, equipment: ['none'], focus: 'core', intensity: 'normal' },
  },
  {
    id: 'legs15',
    title: 'Beine 15',
    subtitle: 'Beine & Po · 15 Min',
    config: { minutes: 15, equipment: ['none'], focus: 'lower', intensity: 'normal' },
  },
  {
    id: 'full20',
    title: 'Ganzkörper 20',
    subtitle: 'Alles dabei · 20 Min',
    config: { minutes: 20, equipment: ['none'], focus: 'full', intensity: 'normal' },
  },
]

export function focusLabel(f: QuickFocus): string {
  return FOCUS_OPTIONS.find((o) => o.id === f)?.label ?? 'Ganzkörper'
}

export function intensityTiming(c: Pick<QuickConfig, 'intensity' | 'work' | 'rest'>): { work: number; rest: number } {
  const base = INTENSITY_OPTIONS.find((o) => o.id === c.intensity) ?? INTENSITY_OPTIONS[1]
  return { work: c.work ?? base.work, rest: c.rest ?? base.rest }
}

// ---------------------------------------------------------------------------
// Zufall (deterministisch)
// ---------------------------------------------------------------------------

/** mulberry32 — kleiner, schneller PRNG mit Seed. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function newSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

// ---------------------------------------------------------------------------
// Kandidaten
// ---------------------------------------------------------------------------

const LOWER: MuscleGroup[] = ['Beine', 'Beinbeuger', 'Gesäß', 'Waden']
const UPPER: MuscleGroup[] = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps']
const CORE: MuscleGroup[] = ['Bauch']

type Zone = 'lower' | 'upper' | 'core'

function zoneOf(m: MuscleGroup): Zone | null {
  if (LOWER.includes(m)) return 'lower'
  if (UPPER.includes(m)) return 'upper'
  if (CORE.includes(m)) return 'core'
  return null
}

/**
 * Übungen, die im Wohnzimmer ohne Bank, Stange, Partner oder Ball schwer gehen
 * oder als Intervall-Station keinen Sinn ergeben (Lauf-Drills, Nacken-Isometrie …).
 */
const UNSUITABLE =
  /bank|bench|partner|klimmz|pull-?up|chin-?up|drill|technik|nacken|neck|schlinge|suspen|ball|box|wand|wall|hang|stange|negativ|decline|kabel|cable|maschine|machine|einarmige liegest|single-arm push|gorilla|towel|handtuch|sprint|inverted|dips|isometri|acceleration|start|carioca|claw|seil|rope|chain|sled|schlitten|weitsprung|long jump|scott|preacher|wrist|handgelenk|turkish|rotation/i

/** Bewährte Intervall-Übungen bekommen einen Bonus (Ergebnis wirkt „kuratiert"). */
export const PREFERRED = new Set([
  'Pushups',
  'Push-Up_Wide',
  'Incline_Push-Up',
  'Body_Tricep_Press',
  'Bodyweight_Squat',
  'Bodyweight_Walking_Lunge',
  'Freehand_Jump_Squat',
  'Split_Jump',
  'Knee_Tuck_Jump',
  'Star_Jump',
  'Mountain_Climbers',
  'Fast_Skipping',
  'Butt_Lift_Bridge',
  'Single_Leg_Glute_Bridge',
  'Glute_Kickback',
  'Plank',
  'Side_Bridge',
  'Crunches',
  'Reverse_Crunch',
  'Russian_Twist',
  'Dead_Bug',
  'Air_Bike',
  'Tuck_Crunch',
  'Sit-Up',
  'Leg_Pull-In',
  'Spider_Crawl',
  'Goblet_Squat',
  'Dumbbell_Lunges',
  'Dumbbell_Squat',
  'Stiff-Legged_Dumbbell_Deadlift',
  'Bent_Over_Two-Dumbbell_Row',
  'Standing_Dumbbell_Press',
  'Dumbbell_Floor_Press',
  'Dumbbell_Bicep_Curl',
  'Hammer_Curls',
  'Side_Lateral_Raise',
  'Tricep_Dumbbell_Kickback',
  'Squats_-_With_Bands',
  'Band_Pull_Apart',
  'Monster_Walk',
  'Hip_Lift_with_Band',
  'Shoulder_Press_-_With_Bands',
  'Upright_Row_-_With_Bands',
  'Back_Flyes_-_With_Bands',
  'One-Arm_Kettlebell_Swings',
  'Kettlebell_Halo',
  'Kettlebell_Thruster',
  'Alternating_Floor_Press',
  'Kettlebell_One-Legged_Deadlift',
  'Vertical_Swing',
])

/** Aufwärmen: erste vorhandene Übung (Hampelmann-Stil). */
export const WARMUP_IDS = ['Jumping_Jacks', 'Star_Jump', 'Fast_Skipping', 'Mountain_Climbers']

/** Übungs-„Familie" — verhindert drei Crunch-Varianten in einem Zirkel. */
const FAMILIES: [string, RegExp][] = [
  ['crunch', /crunch/i],
  ['pushup', /liegestütz|push-?up/i],
  ['squat', /kniebeuge|squat/i],
  ['lunge', /ausfallschritt|lunge/i],
  ['plank', /stütz|plank|bridge/i],
  ['curl', /curl/i],
  ['situp', /sit-?up/i],
  ['raise', /seitheben|frontheben|lateral raise|front raise/i],
  ['triceps', /trizeps|triceps|kickback/i],
  ['press', /drücken|press/i],
  ['row', /rudern|row/i],
  ['jump', /sprung|jump/i],
  ['swing', /swing/i],
]

export function familyOf(ex: Pick<LibraryExercise, 'name_de' | 'name_en'>): string | null {
  const s = `${ex.name_de} ${ex.name_en}`
  for (const [k, re] of FAMILIES) if (re.test(s)) return k
  return null
}

function allowedEquipment(eq: QuickEquipment[]): Set<string> {
  const out = new Set<string>(['Körpergewicht'])
  for (const e of eq) {
    const opt = EQUIPMENT_OPTIONS.find((o) => o.id === e)
    if (opt) out.add(opt.library)
  }
  return out
}

export function isCardio(ex: LibraryExercise): boolean {
  return ex.category === 'Plyometrie' || /swing|mountain|skipping|jump|sprung/i.test(`${ex.id} ${ex.name_de}`)
}

/** Passt die Übung grundsätzlich (Zuhause, Equipment, Fokus)? */
export function matchesFocus(ex: LibraryExercise, focus: QuickFocus): boolean {
  if (focus === 'cardio') return isCardio(ex) && ex.muscle !== 'Brust'
  const z = zoneOf(ex.muscle)
  if (!z) return false
  return focus === 'full' || z === focus
}

export function candidatePool(
  list: LibraryExercise[],
  cfg: Pick<QuickConfig, 'equipment' | 'focus'>,
): LibraryExercise[] {
  const eq = allowedEquipment(cfg.equipment)
  return list.filter(
    (ex) =>
      ex.home &&
      ex.level !== 'Profi' &&
      eq.has(ex.equipment) &&
      !UNSUITABLE.test(`${ex.id} ${ex.name_de} ${ex.name_en}`) &&
      matchesFocus(ex, cfg.focus),
  )
}

/** Grund-Punktzahl ohne Zufall: Favoriten, Level, Grundübung, gewähltes Equipment. */
export function baseScore(ex: LibraryExercise, cfg: Pick<QuickConfig, 'equipment'>): number {
  let s = 0
  if (PREFERRED.has(ex.id)) s += 4
  if (ex.level === 'Anfänger') s += 2
  else if (ex.level === 'Fortgeschritten') s += 1
  if (ex.mechanic === 'Grundübung') s += 1
  if (ex.equipment !== 'Körpergewicht') {
    // Wer Equipment auswählt, möchte es auch benutzen.
    s += cfg.equipment.includes('none') ? 1.5 : 3
  }
  return s
}

// ---------------------------------------------------------------------------
// Struktur (Stationen × Runden)
// ---------------------------------------------------------------------------

/** Gesamtdauer in Sekunden für eine Struktur (Pause nach der letzten Station einer Runde entfällt). */
export function totalSeconds(o: {
  stations: number
  rounds: number
  work: number
  rest: number
  warmup: boolean
}): number {
  const round = o.stations * o.work + (o.stations - 1) * o.rest
  return (o.warmup ? WARMUP_SECONDS : 0) + o.rounds * round + (o.rounds - 1) * ROUND_REST_SECONDS
}

/** Wählt Stationen (ideal 6–8) und Runden so, dass die Gesamtzeit ≈ Wunschdauer ist. */
export function planStructure(cfg: QuickConfig): { stations: number; rounds: number } {
  const { work, rest } = intensityTiming(cfg)
  const warmup = cfg.warmup ?? true
  const target = cfg.minutes * 60
  let best = { stations: 6, rounds: 1, score: Infinity }
  const sRange = cfg.stations ? [cfg.stations] : [4, 5, 6, 7, 8, 9, 10]
  const rRange = cfg.rounds ? [cfg.rounds] : [1, 2, 3, 4, 5, 6]
  for (const s of sRange) {
    for (const r of rRange) {
      const t = totalSeconds({ stations: s, rounds: r, work, rest, warmup })
      let score = Math.abs(t - target)
      if (!cfg.stations) score += 25 * Math.max(0, 6 - s) + 25 * Math.max(0, s - 8)
      // Ab 15 Minuten lieber mehrere Runden als ein langer Zirkel
      if (!cfg.rounds && cfg.minutes >= 15 && r === 1) score += 90
      if (score < best.score) best = { stations: s, rounds: r, score }
    }
  }
  return { stations: best.stations, rounds: best.rounds }
}

// ---------------------------------------------------------------------------
// Auswahl
// ---------------------------------------------------------------------------

const ZONE_CYCLE: Zone[] = ['lower', 'upper', 'core']

/**
 * Wählt `count` Stationen: gewichtet nach Punktzahl + Seed-Zufall, ohne Duplikate,
 * möglichst ohne denselben Muskel direkt hintereinander und ohne Familien-Häufung.
 * Ganzkörper wechselt Beine → Oberkörper → Bauch. Bei zu kleinem Pool werden die
 * Regeln schrittweise gelockert.
 */
export function pickStations(
  list: LibraryExercise[],
  cfg: QuickConfig,
  count: number,
  exclude: string[] = [],
): LibraryExercise[] {
  const random = rng(cfg.seed)
  const pool = candidatePool(list, cfg)
    .filter((e) => !exclude.includes(e.id))
    .map((ex) => ({ ex, score: baseScore(ex, cfg) + random() * 4 }))
    .sort((a, b) => b.score - a.score || a.ex.id.localeCompare(b.ex.id))
    .map((x) => x.ex)

  const picked: LibraryExercise[] = []
  const families = new Map<string, number>()
  const zoneStart = Math.floor(random() * 3)

  for (let i = 0; i < count; i++) {
    const prev = picked[picked.length - 1]
    const zone = cfg.focus === 'full' ? ZONE_CYCLE[(zoneStart + i) % 3] : null
    const ok = (ex: LibraryExercise, level: number) => {
      if (picked.includes(ex)) return false
      if (level < 3) {
        const fam = familyOf(ex)
        if (fam && (families.get(fam) ?? 0) >= (level < 2 ? 1 : 2)) return false
      }
      if (level < 2 && prev && ex.muscle === prev.muscle) return false
      if (level < 1 && zone && zoneOf(ex.muscle) !== zone) return false
      return true
    }
    let next: LibraryExercise | undefined
    for (let level = 0; level <= 3 && !next; level++) next = pool.find((ex) => ok(ex, level))
    if (!next) break
    picked.push(next)
    const fam = familyOf(next)
    if (fam) families.set(fam, (families.get(fam) ?? 0) + 1)
  }
  return picked
}

/** Ersatz-Vorschläge für eine Station (gleicher Fokus/Equipment, ohne die aktuellen). */
export function swapCandidates(
  list: LibraryExercise[],
  cfg: Pick<QuickConfig, 'equipment' | 'focus'>,
  current: string[],
): LibraryExercise[] {
  return candidatePool(list, cfg)
    .filter((e) => !current.includes(e.id))
    .sort((a, b) => baseScore(b, cfg) - baseScore(a, cfg) || a.name_de.localeCompare(b.name_de, 'de'))
}

export function findWarmup(list: LibraryExercise[]): LibraryExercise | null {
  for (const id of WARMUP_IDS) {
    const ex = list.find((e) => e.id === id)
    if (ex) return ex
  }
  return null
}

// ---------------------------------------------------------------------------
// Intervalle
// ---------------------------------------------------------------------------

export type IntervalKind = 'work' | 'rest' | 'roundRest' | 'warmup'

export interface Interval {
  kind: IntervalKind
  exerciseId?: string
  seconds: number
  /** 1-basiert; 0 beim Aufwärmen. */
  round: number
  /** Index der Station (bei Pausen: die als Nächstes folgende). */
  station: number
}

export interface QuickWorkout {
  config: QuickConfig
  stations: string[]
  rounds: number
  work: number
  rest: number
  warmupId: string | null
  intervals: Interval[]
  totalSeconds: number
}

export function buildIntervals(o: {
  stations: string[]
  rounds: number
  work: number
  rest: number
  warmupId: string | null
}): Interval[] {
  const out: Interval[] = []
  if (o.warmupId) out.push({ kind: 'warmup', exerciseId: o.warmupId, seconds: WARMUP_SECONDS, round: 0, station: 0 })
  for (let r = 1; r <= o.rounds; r++) {
    o.stations.forEach((id, i) => {
      out.push({ kind: 'work', exerciseId: id, seconds: o.work, round: r, station: i })
      const last = i === o.stations.length - 1
      if (!last && o.rest > 0) out.push({ kind: 'rest', seconds: o.rest, round: r, station: i + 1 })
    })
    if (r < o.rounds) out.push({ kind: 'roundRest', seconds: ROUND_REST_SECONDS, round: r + 1, station: 0 })
  }
  return out
}

/** Komplettes Workout aus der Bibliothek erzeugen. */
export function generateQuickWorkout(list: LibraryExercise[], cfg: QuickConfig): QuickWorkout {
  const { work, rest } = intensityTiming(cfg)
  const { stations: count, rounds } = planStructure(cfg)
  const useWarmup = cfg.warmup ?? true
  const warm = useWarmup ? findWarmup(list) : null
  const picked = pickStations(list, cfg, count, warm ? [warm.id] : [])
  return assemble(cfg, picked.map((e) => e.id), rounds, work, rest, warm?.id ?? null)
}

function assemble(
  config: QuickConfig,
  stations: string[],
  rounds: number,
  work: number,
  rest: number,
  warmupId: string | null,
): QuickWorkout {
  const intervals = buildIntervals({ stations, rounds, work, rest, warmupId })
  return {
    config,
    stations,
    rounds,
    work,
    rest,
    warmupId,
    intervals,
    totalSeconds: intervals.reduce((s, i) => s + i.seconds, 0),
  }
}

/** Eine Station austauschen (Struktur bleibt gleich). */
export function replaceStation(w: QuickWorkout, index: number, exerciseId: string): QuickWorkout {
  const stations = w.stations.map((id, i) => (i === index ? exerciseId : id))
  return assemble(w.config, stations, w.rounds, w.work, w.rest, w.warmupId)
}

// ---------------------------------------------------------------------------
// Auswertung
// ---------------------------------------------------------------------------

/** Geschätzte Wiederholungen für eine zeitbasierte Station (≈ 3 s pro Wiederholung). */
export function estimateReps(seconds: number): number {
  return Math.max(1, Math.round(seconds / 3))
}

/** kcal ≈ MET × kg × Stunden (MET 8 = zügiges Zirkeltraining). */
export function estimateKcal(seconds: number, kg: number, met = 8): number {
  const w = Number.isFinite(kg) && kg > 0 ? kg : 75
  return Math.round((met * w * Math.max(0, seconds)) / 3600)
}

export function workoutName(minutes: number): string {
  return `Schnell-Workout ${minutes} Min`
}

/** „12:30" bzw. „0:45". */
export function mmss(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
