// Gespeicherte Mahlzeiten: Einträge einer Mahlzeit als Vorlage sichern und mit einem Tipp wieder eintragen.

import type { FoodEntry, Meal } from '../types'

/** Ein Posten einer gespeicherten Mahlzeit (Nährwerte wie im Tagebuch, absolut). */
export interface SavedMealItem {
  name: string
  amount_g: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sat_fat: number
  salt: number
  barcode: string | null
  fluid_ml?: number | null
}

export interface SavedMeal {
  id: string
  user_id: string
  name: string
  meal: Meal
  items: SavedMealItem[]
  created_at: string
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Tagebuch-Einträge → Posten (nur, was zum Wiedereintragen nötig ist). */
export function itemsFromEntries(entries: readonly FoodEntry[]): SavedMealItem[] {
  return entries.map((e) => ({
    name: e.name,
    amount_g: e.amount_g ?? null,
    kcal: num(e.kcal),
    protein: num(e.protein),
    carbs: num(e.carbs),
    fat: num(e.fat),
    fiber: num(e.fiber),
    sugar: num(e.sugar),
    sat_fat: num(e.sat_fat),
    salt: num(e.salt),
    barcode: e.barcode ?? null,
    ...(num(e.fluid_ml) > 0 ? { fluid_ml: num(e.fluid_ml) } : {}),
  }))
}

/** Posten robust lesen (jsonb kann alles enthalten). */
export function normalizeItems(raw: unknown): SavedMealItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && typeof x.name === 'string')
    .map((x) => ({
      name: String(x.name).slice(0, 120),
      amount_g: num(x.amount_g) || null,
      kcal: Math.round(num(x.kcal)),
      protein: num(x.protein),
      carbs: num(x.carbs),
      fat: num(x.fat),
      fiber: num(x.fiber),
      sugar: num(x.sugar),
      sat_fat: num(x.sat_fat),
      salt: num(x.salt),
      barcode: typeof x.barcode === 'string' ? x.barcode : null,
      ...(num(x.fluid_ml) > 0 ? { fluid_ml: num(x.fluid_ml) } : {}),
    }))
}

/** Summe kcal / Eiweiß einer gespeicherten Mahlzeit. */
export function savedMealTotals(items: readonly SavedMealItem[]): { kcal: number; protein: number } {
  return {
    kcal: Math.round(items.reduce((s, i) => s + i.kcal, 0)),
    protein: Math.round(items.reduce((s, i) => s + i.protein, 0)),
  }
}

const NAME_BASE: Record<Meal, string> = {
  breakfast: 'Mein Frühstück',
  lunch: 'Mein Mittagessen',
  dinner: 'Mein Abendessen',
  snack: 'Mein Snack',
}

/** Vorschlag für den Namen: „Mein Frühstück“, bei Doppelung „Mein Frühstück 2“ … */
export function defaultMealName(meal: Meal, existing: readonly string[] = []): string {
  const base = NAME_BASE[meal]
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  if (!taken.has(base.toLowerCase())) return base
  for (let i = 2; i < 100; i++) if (!taken.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`
  return base
}

/** Posten → Tagebuch-Einträge für Tag und Mahlzeit. */
export function entriesFromSaved(items: readonly SavedMealItem[], date: string, meal: Meal) {
  return items.map((i) => ({
    date,
    meal,
    name: i.name,
    amount_g: i.amount_g,
    kcal: Math.round(i.kcal),
    protein: i.protein,
    carbs: i.carbs,
    fat: i.fat,
    fiber: i.fiber,
    sugar: i.sugar,
    sat_fat: i.sat_fat,
    salt: i.salt,
    barcode: i.barcode,
    ...(i.fluid_ml ? { fluid_ml: i.fluid_ml } : {}),
  }))
}

/** Reihenfolge der Chips: passende Mahlzeit zuerst, sonst neueste zuerst. */
export function sortSavedMeals(list: readonly SavedMeal[], meal: Meal | null): SavedMeal[] {
  return [...list].sort(
    (a, b) =>
      (meal ? Number(b.meal === meal) - Number(a.meal === meal) : 0) || b.created_at.localeCompare(a.created_at),
  )
}
