// Kalorienbedarf eines Tages aus der echten Aktivität:
// Grundumsatz (Mifflin-St Jeor) + Alltag (Schritte, sonst Alltags-Einstellung) + Training + Verdauung (~10 %).
// Ziel „nach Aktivität“: Bedarf mit halber Trainings-Gutschrift plus Ziel-Anpassung (−500 / +300 / −200).
// Heute zählen mindestens die Ø-Schritte der letzten 7 Tage – sonst wäre das Ziel morgens zu niedrig.
// Reine Logik – getestet in energy.test.ts.

import type { ActivityLevel, NutritionGoal, Sex } from '../types'
import { BONUS_SHARE } from './trainingKcal'

export interface BodyData {
  sex: Sex
  age: number
  height_cm: number
  weight_kg: number
  activity: ActivityLevel
  goal: NutritionGoal
}

export type TargetMode = 'fixed' | 'activity'

/**
 * Alltag ohne Sport (PAL inkl. Verdauung) je gespeicherter Aktivitätsstufe. Die Stufe enthielt früher auch
 * den Sport – der zählt jetzt getrennt, daher bewusst niedrige Werte.
 */
const EVERYDAY_PAL: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.25,
  moderate: 1.3,
  active: 1.35,
  very_active: 1.45,
}

/** Schritte, die im „sitzenden“ Grundwert schon stecken */
export const BASE_STEPS = 4000
/** ≈ 0,5 kcal je 1000 Schritte und kg (≈ 0,04 kcal/Schritt bei 80 kg) */
const KCAL_PER_STEP_KG = 0.0005
export const GOAL_ADJUST: Record<NutritionGoal, number> = { lose: -500, maintain: 0, gain: 300, recomp: -200 }
export const MIN_TARGET = 1200

const round10 = (n: number) => Math.round(n / 10) * 10

export function bmr(b: Pick<BodyData, 'sex' | 'age' | 'height_cm' | 'weight_kg'>): number {
  return 10 * b.weight_kg + 6.25 * b.height_cm - 5 * b.age + (b.sex === 'm' ? 5 : -161)
}

export const stepsKcal = (steps: number, kg: number) => Math.max(0, steps - BASE_STEPS) * KCAL_PER_STEP_KG * kg

export interface DayNeed {
  bmr: number
  /** Alltag (Bewegung ohne Sport) */
  everyday: number
  training: number
  /** Verdauung (thermischer Effekt) */
  digestion: number
  total: number
  /** Woher der Alltag kommt */
  source: 'steps' | 'setting'
  steps: number | null
}

/** Kalorienbedarf eines Tages. `steps` null = keine Schritte bekannt → Alltags-Einstellung. */
export function dayNeed(b: BodyData, steps: number | null, trainingKcal: number): DayNeed {
  const base = bmr(b)
  const everyday = steps != null ? base * 0.1 + stepsKcal(steps, b.weight_kg) : base * (EVERYDAY_PAL[b.activity] - 1.1)
  const digestion = (base + everyday + trainingKcal) * 0.1
  return {
    bmr: Math.round(base),
    everyday: Math.round(everyday),
    training: Math.round(trainingKcal),
    digestion: Math.round(digestion),
    total: round10(base + everyday + trainingKcal + digestion),
    source: steps != null ? 'steps' : 'setting',
    steps,
  }
}

/** Kalorienziel nach Aktivität: Training nur zur Hälfte, dann Ziel-Anpassung, mind. 1200. */
export function activityTarget(b: BodyData, steps: number | null, trainingKcal: number): number {
  const n = dayNeed(b, steps, trainingKcal * BONUS_SHARE)
  return Math.max(MIN_TARGET, round10(n.total + GOAL_ADJUST[b.goal]))
}

/** Schritte für einen Tag: vergangene Tage echt, heute mindestens der Ø der letzten 7 Tage. */
export function stepsFor(date: string, today: string, byDate: ReadonlyMap<string, number>): number | null {
  const v = byDate.get(date)
  if (date !== today) return v ?? null
  const past = [...byDate.entries()].filter(([d, s]) => d < today && s > 0).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  const avg = past.length >= 3 ? past.slice(0, 7).reduce((s, [, x]) => s + x, 0) / Math.min(7, past.length) : null
  if (v == null) return avg != null ? Math.round(avg) : null
  return Math.round(Math.max(v, avg ?? 0))
}

/** Sind die Körperdaten vollständig genug für eine Berechnung? */
export function hasBody(s: Partial<BodyData> | null | undefined): s is BodyData {
  return !!s && !!s.sex && !!s.age && !!s.height_cm && !!s.weight_kg && !!s.activity && !!s.goal
}
