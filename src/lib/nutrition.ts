import type { ActivityLevel, NutritionGoal, Sex } from '../types'

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
}

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sitzend (kaum Bewegung)',
  light: 'Leicht aktiv (1–2×/Woche)',
  moderate: 'Mäßig aktiv (3–4×/Woche)',
  active: 'Aktiv (5–6×/Woche)',
  very_active: 'Sehr aktiv (täglich/körperlich)',
}

export const GOAL_LABEL: Record<NutritionGoal, string> = {
  lose: 'Abnehmen',
  maintain: 'Halten',
  gain: 'Aufbauen',
}

export interface TargetInput {
  sex: Sex
  age: number
  height_cm: number
  weight_kg: number
  activity: ActivityLevel
  goal: NutritionGoal
}

export interface MacroTargets {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

/**
 * Tages-Kalorienziel + Makros aus Körperdaten (keine KI).
 * Grundumsatz nach Mifflin-St Jeor, mal Aktivitätsfaktor, plus Ziel-Anpassung.
 */
export function computeTargets(input: TargetInput): MacroTargets {
  const { sex, age, height_cm, weight_kg, activity, goal } = input
  const bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + (sex === 'm' ? 5 : -161)
  const tdee = bmr * ACTIVITY_FACTORS[activity]
  const adjust = goal === 'lose' ? -500 : goal === 'gain' ? 300 : 0
  const kcal = Math.max(1200, Math.round(tdee + adjust)) // Sicherheits-Untergrenze

  const protein = Math.round(1.8 * weight_kg) // g
  const fat = Math.round(0.8 * weight_kg) // g
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)) // Rest

  return { kcal, protein, carbs, fat }
}

/** Summiert die Tageswerte mehrerer Einträge (gerundet). */
export function sumEntries(
  entries: { kcal: number; protein: number; carbs: number; fat: number }[],
): MacroTargets {
  const t = entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
  }
}

/** Skaliert Nährwerte pro 100 g auf eine Menge in Gramm. */
export function scalePer100(
  per100: { kcal: number; protein: number; carbs: number; fat: number },
  grams: number,
): MacroTargets {
  const f = grams / 100
  return {
    kcal: Math.round(per100.kcal * f),
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
  }
}
