// Schlafbedarf für heute Nacht: Grundbedarf + Belastung des Tages + ein Teil der Schlafschuld,
// dazu eine Zubettgehzeit passend zur Aufstehzeit. Reine Logik – getestet in sleepNeed.test.ts.

import { shiftDate } from './day'
import { sleepDebt } from './insights'

export type StrainLevel = 'rest' | 'light' | 'normal' | 'hard' | 'very'

export const STRAIN_LABEL: Record<StrainLevel, string> = {
  rest: 'Ruhetag',
  light: 'Leichter Tag',
  normal: 'Trainingstag',
  hard: 'Harter Tag',
  very: 'Sehr harter Tag',
}

/** Zusatz-Minuten je Belastung (angelehnt an Erholungsbedarf nach Training: 10–45 min). */
const STRAIN_MIN: Record<StrainLevel, number> = { rest: 0, light: 10, normal: 20, hard: 30, very: 45 }
/** Höchstens so viel Schlafschuld pro Nacht nachholen – mehr klappt meist nicht. */
export const MAX_PAYBACK = 60

export interface SleepNeed {
  needMin: number
  baseMin: number
  strainMin: number
  strain: StrainLevel
  /** Anteil Schlafschuld, der heute Nacht dazukommt */
  paybackMin: number
  /** gesamte Schlafschuld der letzten 7 Nächte (null = zu wenig Nächte) */
  debtMin: number | null
}

const round5 = (n: number) => Math.round(n / 5) * 5

/** Belastung heute im Vergleich zu deinen üblichen Trainingstagen (letzte 28 Tage). */
export function strainLevel(load: ReadonlyMap<string, number>, today: string): StrainLevel {
  const now = load.get(today) ?? 0
  if (now <= 0) return 'rest'
  const from = shiftDate(today, -28)
  const past = [...load.entries()].filter(([d, v]) => d >= from && d < today && v > 0).map(([, v]) => v)
  const ratio = past.length >= 3 ? now / (past.reduce((s, v) => s + v, 0) / past.length) : 1
  return ratio < 0.6 ? 'light' : ratio <= 1.3 ? 'normal' : ratio <= 1.8 ? 'hard' : 'very'
}

export function sleepNeed(i: {
  baseMin: number
  today: string
  load: ReadonlyMap<string, number>
  sleep: readonly { date: string; asleep_min: number }[]
}): SleepNeed {
  const strain = strainLevel(i.load, i.today)
  const strainMin = STRAIN_MIN[strain]
  const debt = sleepDebt(i.sleep, i.today, i.baseMin)
  const paybackMin = debt && debt.debtMin > 0 ? Math.min(MAX_PAYBACK, round5(debt.debtMin / 4)) : 0
  return {
    needMin: i.baseMin + strainMin + paybackMin,
    baseMin: i.baseMin,
    strainMin,
    strain,
    paybackMin,
    debtMin: debt ? debt.debtMin : null,
  }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const fromMin = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

/** Übliche Aufstehzeit: Median der letzten 14 Nächte (mind. 4), auf 5 min gerundet. */
export function typicalWake(sleep: readonly { date: string; end_at: string }[], today: string): string | null {
  const from = shiftDate(today, -13)
  const mins = sleep
    .filter((n) => n.date >= from && n.date <= today && n.end_at)
    .map((n) => {
      const d = new Date(n.end_at)
      return d.getHours() * 60 + d.getMinutes()
    })
    .sort((a, b) => a - b)
  if (mins.length < 4) return null
  const mid = mins.length % 2 ? mins[(mins.length - 1) / 2] : (mins[mins.length / 2 - 1] + mins[mins.length / 2]) / 2
  return fromMin(round5(mid))
}

/** Anteil der Bettzeit, in der du wirklich schläfst (14 Nächte; Standard 90 %). */
export function sleepEfficiency(
  sleep: readonly { date: string; asleep_min: number; in_bed_min?: number | null }[],
  today: string,
): number {
  const from = shiftDate(today, -13)
  const r = sleep
    .filter((n) => n.date >= from && n.in_bed_min && n.in_bed_min > 0 && n.asleep_min > 0)
    .map((n) => n.asleep_min / n.in_bed_min!)
  if (r.length < 3) return 0.9
  return Math.min(0.98, Math.max(0.8, r.reduce((s, x) => s + x, 0) / r.length))
}

/** Ins Bett um …, damit bis zur Aufstehzeit `needMin` Schlaf drin ist. */
export function bedtimePlan(needMin: number, wake: string, efficiency = 0.9): { bedAt: string; inBedMin: number } {
  const inBedMin = round5(needMin / efficiency)
  return { bedAt: fromMin(toMin(wake) - inBedMin), inBedMin }
}
