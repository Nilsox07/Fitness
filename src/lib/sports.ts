// Manuell eingetragene Aktivitäten (Radfahren, Volleyball, Schwimmen …): Sportarten mit MET-Werten aus dem
// Compendium of Physical Activities (locker / mittel / hart). Kalorien = Mehrverbrauch über dem Ruheumsatz:
// (MET − 1) × kg × Stunden – gleiche Rechnung wie beim Krafttraining (src/lib/trainingKcal.ts).
// Reine Logik – getestet in sports.test.ts.

export type Intensity = 'easy' | 'moderate' | 'hard'

export const INTENSITY_LABEL: Record<Intensity, string> = { easy: 'Locker', moderate: 'Mittel', hard: 'Hart' }

export interface Sport {
  id: string
  label: string
  /** MET locker / mittel / hart */
  met: [number, number, number]
  /** Strecke sinnvoll (km) */
  distance?: boolean
  /** Zählt als Ausdauer-Einheit für den Ausdauer-Plan (Hybrid) */
  cardio?: 'run' | 'bike' | 'walk' | 'any'
  /** Suchbegriffe */
  keywords?: string
}

export const SPORTS: Sport[] = [
  {
    id: 'bike',
    label: 'Radfahren',
    met: [4, 6.8, 10],
    distance: true,
    cardio: 'bike',
    keywords: 'rad fahrrad mtb rennrad e-bike',
  },
  { id: 'run', label: 'Laufen', met: [7, 9.8, 11.5], distance: true, cardio: 'run', keywords: 'joggen rennen' },
  { id: 'walk', label: 'Spazieren', met: [3, 3.8, 5], distance: true, cardio: 'walk', keywords: 'gehen walken nordic' },
  { id: 'hike', label: 'Wandern', met: [5.3, 6.5, 7.8], distance: true, cardio: 'walk', keywords: 'berg trekking' },
  {
    id: 'swim',
    label: 'Schwimmen',
    met: [5.8, 8.3, 10],
    distance: true,
    cardio: 'any',
    keywords: 'bahnen kraulen brust',
  },
  { id: 'volleyball', label: 'Volleyball', met: [3, 4, 6], keywords: 'beach' },
  { id: 'football', label: 'Fußball', met: [5, 7, 10], keywords: 'soccer kicken' },
  { id: 'basketball', label: 'Basketball', met: [4.5, 6.5, 8] },
  { id: 'handball', label: 'Handball', met: [6, 8, 12] },
  { id: 'tennis', label: 'Tennis', met: [5, 7.3, 8] },
  { id: 'padel', label: 'Padel', met: [5, 6.5, 7.5] },
  { id: 'badminton', label: 'Badminton', met: [4.5, 5.5, 7], keywords: 'federball' },
  { id: 'tabletennis', label: 'Tischtennis', met: [3, 4, 5], keywords: 'ping pong' },
  { id: 'climb', label: 'Klettern', met: [5.8, 7.5, 8], keywords: 'bouldern' },
  { id: 'martial', label: 'Kampfsport', met: [5.3, 7.5, 10.3], keywords: 'boxen judo karate mma kickboxen' },
  { id: 'spinning', label: 'Indoor-Cycling', met: [5.5, 7, 8.5], cardio: 'bike', keywords: 'spinning ergometer' },
  { id: 'row', label: 'Rudern', met: [4.8, 7, 8.5], distance: true, cardio: 'any', keywords: 'ergometer kajak kanu' },
  { id: 'hiit', label: 'Kurs / HIIT', met: [5, 7, 8], keywords: 'zirkel crossfit bootcamp aerobic zumba' },
  { id: 'yoga', label: 'Yoga', met: [2.5, 3, 4], keywords: 'stretching mobility' },
  { id: 'pilates', label: 'Pilates', met: [3, 3.5, 4.5] },
  { id: 'dance', label: 'Tanzen', met: [3.5, 5, 7.3] },
  { id: 'inline', label: 'Inlineskaten', met: [5.5, 7.5, 9.8], distance: true, keywords: 'skaten rollschuh' },
  { id: 'ski', label: 'Ski / Snowboard', met: [4.3, 5.3, 8], keywords: 'langlauf' },
  { id: 'garden', label: 'Gartenarbeit', met: [3, 3.8, 5], keywords: 'umzug arbeit körperlich' },
  { id: 'other', label: 'Sonstiges', met: [3.5, 5, 7] },
]

const BY_ID = new Map(SPORTS.map((s) => [s.id, s]))
export const sportById = (id: string) => BY_ID.get(id) ?? BY_ID.get('other')!

/** Suche über Name und Stichwörter (ohne Groß/Klein, ohne Umlaut-Sorgen). */
export function searchSports(q: string): Sport[] {
  const n = (s: string) =>
    s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  const words = n(q).split(/\s+/).filter(Boolean)
  if (!words.length) return SPORTS
  return SPORTS.filter((s) => {
    const hay = n(`${s.label} ${s.keywords ?? ''}`)
    return words.every((w) => hay.includes(w))
  })
}

export interface ManualActivity {
  id: string
  date: string
  sport: string
  minutes: number
  intensity: Intensity
  distance_km: number | null
  kcal: number
  note: string | null
  created_at: string
}

const round10 = (n: number) => Math.round(n / 10) * 10
const IDX: Record<Intensity, 0 | 1 | 2> = { easy: 0, moderate: 1, hard: 2 }

/** Mehrverbrauch einer Aktivität in kcal (gerundet auf 10). */
export function activityKcal(sportId: string, intensity: Intensity, minutes: number, kg: number): number {
  const met = sportById(sportId).met[IDX[intensity]]
  return round10(((met - 1) * (kg || 75) * Math.max(0, minutes)) / 60)
}

/** „Volleyball · 90 min · Mittel“ */
export function activityTitle(a: Pick<ManualActivity, 'sport' | 'minutes' | 'intensity' | 'distance_km'>): string {
  const parts = [sportById(a.sport).label, `${a.minutes} min`]
  if (a.distance_km) parts.push(`${a.distance_km.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`)
  return parts.join(' · ')
}

/** Zuletzt genutzte Kombinationen (Sportart + Dauer + Intensität), neueste zuerst, ohne Doppelte. */
export function recentActivities(list: readonly ManualActivity[], n = 4): ManualActivity[] {
  const seen = new Set<string>()
  const out: ManualActivity[] = []
  for (const a of [...list].sort((x, y) => (x.created_at < y.created_at ? 1 : -1))) {
    const key = `${a.sport}|${a.minutes}|${a.intensity}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
    if (out.length >= n) break
  }
  return out
}

/** Uhr-Typ → Sportart (für Dubletten-Erkennung) */
const WATCH_TO_SPORT: Record<string, string[]> = {
  run: ['run'],
  ride: ['bike', 'spinning'],
  walk: ['walk', 'hike'],
  hike: ['hike', 'walk'],
  swim: ['swim'],
  row: ['row'],
}

const MAPPED = new Set(Object.values(WATCH_TO_SPORT).flat())

/**
 * Hat die Uhr dieselbe Aktivität schon? Gleicher Tag, passende Sportart (bei „other“ jede Ballsport-/Kursart)
 * und Dauer ±35 %. Dann zählt nur die Uhr.
 */
export function coveredByWatch(
  a: Pick<ManualActivity, 'date' | 'sport' | 'minutes'>,
  watch: readonly { started_at: string; duration_s: number; type: string }[],
): boolean {
  return watch.some((w) => {
    if (w.started_at.slice(0, 10) !== a.date) return false
    const match = WATCH_TO_SPORT[w.type]
    // Uhr „sonstiges“ passt zu allem, was keine Lauf-/Rad-/Geh-/Schwimm-/Ruder-Art ist (Ballsport, Kurse …)
    if (match ? !match.includes(a.sport) : MAPPED.has(a.sport)) return false
    const min = w.duration_s / 60
    return min >= a.minutes * 0.65 && min <= a.minutes * 1.35
  })
}
