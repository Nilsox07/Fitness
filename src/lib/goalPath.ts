// Zielgewicht → „ungefährer Weg“: Richtung, Rest, Wochenziel und eine Spanne in Wochen.
// Bewusst kein festes Datum – nur eine grobe Spanne aus üblichen Wochenraten. Rein und testbar.

import { weightTrend, type WeightPoint } from './weightTrend'

export type GoalType = 'lose' | 'gain' | 'maintain' | 'recomp'

/** Wochenraten in Prozent des Körpergewichts (langsam, zügig). */
export const RATES = {
  down: [0.005, 0.01],
  up: [0.0025, 0.005],
} as const

/** Recomp: Gewicht soll sich nur langsam bewegen → halbe Raten. */
const RECOMP_FACTOR = 0.5

/** Ab so wenig Rest gilt das Ziel als erreicht (kg). */
export const REACHED_TOLERANCE = 0.5

export type GoalPathStatus = 'no_target' | 'no_data' | 'reached' | 'path'

export interface GoalPath {
  status: GoalPathStatus
  target: number | null
  /** Aktuelles Trendgewicht (geglättet) */
  current: number | null
  /** Startgewicht für den Fortschrittsbalken */
  start: number | null
  direction: 'down' | 'up' | 'hold'
  /** Noch zu bewegen (kg, immer ≥ 0) */
  remaining: number
  /** Gesamtstrecke Start → Ziel (kg, ≥ 0) */
  total: number
  /** Anteil geschafft (0–1) */
  progress: number
  /** Wochenziel in kg mit Vorzeichen (z. B. −0,6) */
  weekly: number
  /** Nächster Wochen-Meilenstein (Trendgewicht in einer Woche) */
  milestone: number | null
  /** Geschätzte Spanne in Wochen */
  weeksMin: number
  weeksMax: number
  /** Gewähltes Ziel passt nicht zur Richtung (z. B. „Abnehmen“, aber Zielgewicht höher) */
  mismatch: boolean
}

const r1 = (n: number) => Math.round(n * 10) / 10

const EMPTY: Omit<GoalPath, 'status' | 'target'> = {
  current: null,
  start: null,
  direction: 'hold',
  remaining: 0,
  total: 0,
  progress: 0,
  weekly: 0,
  milestone: null,
  weeksMin: 0,
  weeksMax: 0,
  mismatch: false,
}

/** Wochen bis zum Ziel bei fester Wochenrate (Prozent vom jeweils aktuellen Gewicht). */
function weeksAt(current: number, target: number, rate: number): number {
  if (rate <= 0) return Infinity
  const ratio = target < current ? current / target : target / current
  const perWeek = target < current ? 1 / (1 - rate) : 1 + rate
  return Math.log(ratio) / Math.log(perWeek)
}

export function goalPath(input: {
  weights: WeightPoint[]
  target: number | null | undefined
  goal?: GoalType | null
  /** Seit wann das Zielgewicht gilt (YYYY-MM-DD) – erste Messung danach ist der Start */
  since?: string | null
}): GoalPath {
  const target = input.target && Number.isFinite(input.target) && input.target > 0 ? input.target : null
  if (target === null) return { status: 'no_target', target: null, ...EMPTY }
  const trend = weightTrend(input.weights)
  if (!trend.length) return { status: 'no_data', target, ...EMPTY }

  const current = trend[trend.length - 1].trend
  const startPoint = (input.since && trend.find((p) => p.date >= input.since!)) || trend[0]
  // Start = gemessenes Gewicht am Starttag (nicht geglättet), damit der Balken bei 0 beginnt
  const start = startPoint.kg
  const goal = input.goal ?? null

  const delta = target - current
  const fromStart = target - start
  // Über das Ziel hinaus (gestartet über dem Ziel, jetzt darunter – oder umgekehrt)?
  const crossed = Math.abs(fromStart) > REACHED_TOLERANCE && Math.sign(fromStart) !== Math.sign(delta)
  const total = r1(Math.abs(fromStart))
  if (Math.abs(delta) <= REACHED_TOLERANCE || crossed) {
    return {
      ...EMPTY,
      status: 'reached',
      target,
      current,
      start,
      direction: 'hold',
      total,
      progress: total > 0 ? 1 : 0,
      milestone: target,
    }
  }

  const direction = delta < 0 ? 'down' : 'up'
  const factor = goal === 'recomp' ? RECOMP_FACTOR : 1
  const [slow, fast] = RATES[direction].map((r) => r * factor)
  const remaining = r1(Math.abs(delta))
  // Fortschritt nur, wenn der Start auf derselben Seite lag
  const progress =
    Math.sign(fromStart) === Math.sign(delta) && Math.abs(fromStart) > 0
      ? Math.min(1, Math.max(0, 1 - Math.abs(delta) / Math.abs(fromStart)))
      : 0

  // Wochenziel: Mitte der Spanne, mindestens 0,1 kg, höchstens der Rest
  const mid = ((slow + fast) / 2) * current
  const step = Math.min(remaining, Math.max(0.1, r1(mid)))
  const weekly = direction === 'down' ? -step : step

  const weeksMin = Math.max(1, Math.floor(weeksAt(current, target, fast)))
  const weeksMax = Math.max(weeksMin, Math.ceil(weeksAt(current, target, slow)))

  const mismatch =
    (goal === 'lose' && direction === 'up') ||
    (goal === 'gain' && direction === 'down') ||
    (goal === 'maintain' && remaining > 2)

  return {
    status: 'path',
    target,
    current,
    start,
    direction,
    remaining,
    total: Math.max(total, remaining),
    progress,
    weekly: r1(weekly),
    milestone: r1(current + weekly),
    weeksMin,
    weeksMax,
    mismatch,
  }
}

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

/** Signierte kg-Angabe mit typografischem Minus: „−0,6 kg“. */
export function signedKg(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : '±'}${fmt(Math.abs(n))} kg`
}

/** „ca. 20–28 Wochen“, ab einem Jahr in Monaten. */
export function weeksLabel(min: number, max: number): string {
  if (max > 52) {
    const a = Math.max(1, Math.round(min / 4.35))
    const b = Math.max(a, Math.round(max / 4.35))
    return a === b ? `ca. ${a} Monate` : `ca. ${a}–${b} Monate`
  }
  if (min === max) return `ca. ${min} ${min === 1 ? 'Woche' : 'Wochen'}`
  return `ca. ${min}–${max} Wochen`
}

/** Kurze Zeile für Übersichten, z. B. „noch 14,6 kg · ca. 20–28 Wochen“. null = nichts zeigen. */
export function goalPathLine(p: GoalPath): string | null {
  if (p.status === 'reached') return 'Ziel erreicht'
  if (p.status !== 'path') return null
  return `noch ${fmt(p.remaining)} kg · ${weeksLabel(p.weeksMin, p.weeksMax)}`
}
