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
  recomp: 'Body Recomposition',
}

/** Kurzbeschreibung je Ziel — erklärt die Nährwert-Strategie. */
export const GOAL_HINT: Record<NutritionGoal, string> = {
  lose: 'Kaloriendefizit (~500 kcal), viel Eiweiß, um Muskeln zu halten.',
  maintain: 'Kalorien auf Erhaltungsniveau, ausgewogene Makros.',
  gain: 'Kalorienüberschuss (~300 kcal) für Muskelaufbau.',
  recomp: 'Leichtes Defizit (~200 kcal) + sehr viel Eiweiß: Fett runter, Muskeln rauf.',
}

/** Empfohlenes Trinkziel in ml (~35 ml pro kg, auf 250 ml gerundet). */
export function defaultWaterTarget(weight_kg: number): number {
  return Math.max(1500, Math.round((35 * weight_kg) / 250) * 250)
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

  // Kalorien-Anpassung je Ziel (recomp = leichtes Defizit).
  const adjust = goal === 'lose' ? -500 : goal === 'gain' ? 300 : goal === 'recomp' ? -200 : 0
  const kcal = Math.max(1200, Math.round(tdee + adjust)) // Sicherheits-Untergrenze

  // Eiweiß je nach Ziel: im Defizit/Recomp mehr, um Muskeln zu schützen.
  const proteinPerKg = goal === 'lose' || goal === 'recomp' ? 2.2 : goal === 'gain' ? 2.0 : 1.8
  const fatPerKg = goal === 'gain' ? 0.9 : 0.8
  const protein = Math.round(proteinPerKg * weight_kg) // g
  const fat = Math.round(fatPerKg * weight_kg) // g
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)) // Rest

  return { kcal, protein, carbs, fat }
}

export interface Nutrients {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
}

const EMPTY: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sat_fat: 0, salt: 0 }

type PartialNutrients = { kcal: number; protein: number; carbs: number; fat: number } & Partial<Nutrients>

/** Summiert die Tageswerte mehrerer Einträge (gerundet), inkl. Ballaststoffe usw. */
export function sumEntries(entries: PartialNutrients[]): Nutrients {
  const t = entries.reduce<Nutrients>(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs,
      fat: a.fat + e.fat,
      fiber: a.fiber + (e.fiber ?? 0),
      sugar: a.sugar + (e.sugar ?? 0),
      sat_fat: a.sat_fat + (e.sat_fat ?? 0),
      salt: a.salt + (e.salt ?? 0),
    }),
    { ...EMPTY },
  )
  return {
    kcal: Math.round(t.kcal),
    protein: Math.round(t.protein),
    carbs: Math.round(t.carbs),
    fat: Math.round(t.fat),
    fiber: Math.round(t.fiber * 10) / 10,
    sugar: Math.round(t.sugar * 10) / 10,
    sat_fat: Math.round(t.sat_fat * 10) / 10,
    salt: Math.round(t.salt * 100) / 100,
  }
}

/** Skaliert Nährwerte pro 100 g auf eine Menge in Gramm. */
export function scalePer100(per100: PartialNutrients, grams: number): Nutrients {
  const f = grams / 100
  return {
    kcal: Math.round(per100.kcal * f),
    protein: Math.round(per100.protein * f * 10) / 10,
    carbs: Math.round(per100.carbs * f * 10) / 10,
    fat: Math.round(per100.fat * f * 10) / 10,
    fiber: Math.round((per100.fiber ?? 0) * f * 10) / 10,
    sugar: Math.round((per100.sugar ?? 0) * f * 10) / 10,
    sat_fat: Math.round((per100.sat_fat ?? 0) * f * 10) / 10,
    salt: Math.round((per100.salt ?? 0) * f * 100) / 100,
  }
}
