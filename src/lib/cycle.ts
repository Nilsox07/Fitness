// Zyklus: Phase, Zyklustag und nächste Periode aus den eingetragenen Perioden – und was das
// für Training, Gewicht und Hunger bedeutet. Bewusst KEINE Fruchtbarkeits-/Verhütungsaussagen.
// Reine Logik – getestet in cycle.test.ts.

import { shiftDate } from './day'
import { daysBetween } from './schedule'

export interface Period {
  start_date: string
  end_date: string | null
}

export type CyclePhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal'

export interface CycleState {
  /** Tag im aktuellen Zyklus (1 = erster Periodentag) */
  day: number
  phase: CyclePhase
  /** durchschnittliche Zykluslänge (Tage) */
  length: number
  /** durchschnittliche Periodendauer (Tage) */
  periodLength: number
  /** geschätzter Beginn der nächsten Periode */
  nextPeriod: string
  daysUntilNext: number
  /** Periode läuft gerade (eingetragen, ohne Ende oder innerhalb der Dauer) */
  onPeriod: boolean
  /** Die letzten Tage vor der Periode (Wassereinlagerung, mehr Hunger) */
  latePms: boolean
  /** Schätzung auf wenig Daten (nur eine Periode) */
  rough: boolean
}

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstruation: 'Periode',
  follicular: 'Follikelphase',
  ovulation: 'Eisprung-Phase',
  luteal: 'Lutealphase',
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Durchschnittliche Zyklus- und Periodenlänge aus den letzten (bis zu 6) Zyklen. */
export function cycleStats(periods: readonly Period[]): { length: number; periodLength: number; count: number } {
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const g = daysBetween(sorted[i - 1].start_date, sorted[i].start_date)
    if (g >= 18 && g <= 50) gaps.push(g) // Ausreißer (vergessene Einträge) ignorieren
  }
  const lens = sorted
    .filter((p) => p.end_date)
    .map((p) => daysBetween(p.start_date, p.end_date!) + 1)
    .filter((l) => l >= 1 && l <= 10)
  return {
    length: gaps.length ? Math.round(median(gaps.slice(-6))) : 28,
    periodLength: lens.length ? Math.round(median(lens.slice(-6))) : 5,
    count: sorted.length,
  }
}

/** Aktueller Stand – null, wenn noch keine Periode eingetragen ist. */
export function cycleState(periods: readonly Period[], today: string): CycleState | null {
  const past = periods.filter((p) => p.start_date <= today).sort((a, b) => a.start_date.localeCompare(b.start_date))
  const last = past[past.length - 1]
  if (!last) return null
  const { length, periodLength, count } = cycleStats(past)
  const sinceStart = daysBetween(last.start_date, today)
  // Längst überfällig/vergessen: Zyklustag innerhalb eines Zyklus halten
  const day = (sinceStart % length) + 1
  const cycleStart = shiftDate(today, -(day - 1))
  const nextPeriod = shiftDate(cycleStart, length)
  const onPeriod =
    sinceStart < length && (last.end_date ? today <= last.end_date : sinceStart < Math.max(periodLength, 1))
  // Eisprung ≈ 14 Tage vor der nächsten Periode
  const ovulationDay = length - 14
  const phase: CyclePhase = onPeriod
    ? 'menstruation'
    : day < ovulationDay - 1
      ? 'follicular'
      : day <= ovulationDay + 1
        ? 'ovulation'
        : 'luteal'
  const daysUntilNext = daysBetween(today, nextPeriod)
  return {
    day,
    phase,
    length,
    periodLength,
    nextPeriod,
    daysUntilNext,
    onPeriod,
    latePms: phase === 'luteal' && daysUntilNext <= 5,
    rough: count < 2,
  }
}

/** Kurzer Trainings-Hinweis je Phase (eine Zeile). */
export function trainingHint(s: CycleState): string {
  if (s.phase === 'menstruation')
    return s.day <= 2
      ? 'Hör auf deinen Körper – leichter geht heute auch.'
      : 'Training wie gewohnt, wenn es sich gut anfühlt.'
  if (s.phase === 'follicular') return 'Gute Phase für schwere Sätze und neue Bestleistungen.'
  if (s.phase === 'ovulation') return 'Viel Kraft – aufwärmen nicht vergessen.'
  return s.latePms
    ? 'Etwas weniger belastbar – Technik und Volumen statt Maximalgewicht.'
    : 'Normal trainieren, Pausen etwas länger.'
}

/** Erklärung zum Antippen. */
export const PHASE_INFO: Record<CyclePhase, string> = {
  menstruation:
    'Periode: Energie kann an den ersten Tagen niedriger sein. Bewegung hilft oft sogar gegen Krämpfe – Intensität nach Gefühl.',
  follicular:
    'Nach der Periode steigt Östrogen: Viele fühlen sich stark und erholen sich schneller. Ideal für schweres Training.',
  ovulation:
    'Rund um den Eisprung ist die Kraft oft am höchsten. Bänder sind etwas lockerer – gut aufwärmen, saubere Technik.',
  luteal:
    'Progesteron steigt: Körpertemperatur und Puls leicht höher, mehr Hunger, oft Wassereinlagerungen. Das ist normal.',
}

/** Einfluss auf die Tagesform (wird zu den anderen Faktoren addiert). */
export function readinessEffect(s: CycleState): number {
  if (s.phase === 'menstruation') return s.day <= 2 ? -5 : -2
  if (s.latePms) return -3
  if (s.phase === 'follicular') return 2
  return 0
}

/** Gewicht kann wegen Wasser höher sein (späte Lutealphase + erste Periodentage). */
export function waterRetentionLikely(s: CycleState | null): boolean {
  return !!s && (s.latePms || (s.phase === 'menstruation' && s.day <= 3))
}

/** Tage der Periode (eingetragen bzw. geschätzt) für Kalender/Punkte. */
export function periodDays(periods: readonly Period[], defaultLength = 5): Set<string> {
  const out = new Set<string>()
  for (const p of periods) {
    const len = p.end_date ? daysBetween(p.start_date, p.end_date) + 1 : defaultLength
    for (let i = 0; i < Math.min(10, Math.max(1, len)); i++) out.add(shiftDate(p.start_date, i))
  }
  return out
}

export const SYMPTOMS = [
  'Krämpfe',
  'Müde',
  'Kopfschmerzen',
  'Heißhunger',
  'Blähbauch',
  'Unruhig',
  'Voller Energie',
] as const
