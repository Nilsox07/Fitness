// Empfehlungen aus dem Rezept-Katalog: harte Filter nach Ernährungsweise
// (Einschränkungen, Keto/Low Carb), dann Rangfolge nach Ziel, Mahlzeit,
// Rest-Budget des Tages, Eiweiß und Zubereitungszeit. Rein, ohne KI.

import type { DietStyle } from './dietStyle'
import { DIET_MACRO_LABEL, DIET_RESTRICTION_LABEL } from './dietStyle'
import type { CatalogRecipe } from './recipeCatalog'
import type { Meal, NutritionGoal, SavedRecipe } from '../types'

export interface RecommendContext {
  goal: NutritionGoal | null
  diet: DietStyle
  meal: Meal
  /** Noch offene kcal heute (null = kein Ziel gesetzt) */
  remainingKcal: number | null
  /** Noch offenes Eiweiß heute in g */
  remainingProtein: number
}

/** Passt das Rezept zur Ernährungsweise? Einschränkungen und Keto/Low Carb sind hart. */
export function fitsDiet(r: CatalogRecipe, diet: DietStyle): boolean {
  if (!diet.restrictions.every((x) => r.restrictions.includes(x))) return false
  if (diet.macro === 'keto' && !r.macros.includes('keto')) return false
  if (diet.macro === 'low_carb' && !r.macros.includes('low_carb') && !r.macros.includes('keto')) return false
  return true
}

/** Anteil der kcal aus Eiweiß (0–1). */
export function proteinShare(r: Pick<CatalogRecipe, 'kcal' | 'protein'>): number {
  return r.kcal > 0 ? (r.protein * 4) / r.kcal : 0
}

/** Punktzahl für die Rangfolge (höher = besser). */
export function recommendScore(r: CatalogRecipe, ctx: RecommendContext): number {
  const share = proteinShare(r)
  let s = share * 100
  if (r.meal.includes(ctx.meal)) s += 25
  if (ctx.diet.macro !== 'balanced' && r.macros.includes(ctx.diet.macro)) s += 15

  if (ctx.goal === 'lose') {
    if (r.kcal <= 550) s += 15
    if (r.kcal > 800) s -= 25
  } else if (ctx.goal === 'gain') {
    if (r.kcal >= 650) s += 15
    if (r.kcal < 350 && !r.meal.includes('snack')) s -= 10
  } else if (ctx.goal === 'recomp') {
    if (share >= 0.3) s += 10
  }

  if (ctx.remainingKcal != null) {
    if (r.kcal > ctx.remainingKcal + 100) s -= 40
    else if (ctx.remainingKcal > 0) s += 10
  }
  if (ctx.remainingProtein > 0) s += Math.min(r.protein, ctx.remainingProtein) * 0.3
  s -= r.minutes * 0.2
  return s
}

/** Die besten Rezepte für jetzt (nur passende Ernährungsweise). */
export function recommendRecipes(list: readonly CatalogRecipe[], ctx: RecommendContext, limit = 8): CatalogRecipe[] {
  return list
    .filter((r) => fitsDiet(r, ctx.diet))
    .map((r) => ({ r, s: recommendScore(r, ctx) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r)
}

/** Kurzer Grund, warum das Rezept empfohlen wird. */
export function recommendReason(r: CatalogRecipe, ctx: RecommendContext): string {
  const share = proteinShare(r)
  if (ctx.diet.macro === 'keto' && r.macros.includes('keto')) return `Keto · nur ${Math.round(r.carbs)} g KH`
  if (ctx.goal === 'lose' && r.kcal <= 500 && share >= 0.3) return 'Leicht & viel Eiweiß'
  if (ctx.goal === 'gain' && r.kcal >= 650) return 'Ordentlich Energie für den Aufbau'
  if (ctx.remainingProtein >= 30 && r.protein >= 30) return `${Math.round(r.protein)} g Eiweiß für deinen Rest`
  if (r.minutes <= 10) return `In ${r.minutes} Min fertig`
  if (ctx.diet.macro !== 'balanced' && r.macros.includes(ctx.diet.macro)) return DIET_MACRO_LABEL[ctx.diet.macro]
  if (share >= 0.3) return 'Proteinreich'
  return 'Passt zu heute'
}

/** Kurze Beschreibung der aktiven Ernährungsweise, z. B. „Low Carb · Vegetarisch". */
export function dietSummary(diet: DietStyle): string {
  return [DIET_MACRO_LABEL[diet.macro], ...diet.restrictions.map((x) => DIET_RESTRICTION_LABEL[x])].join(' · ')
}

/** Katalog-Rezept in die Form der gespeicherten Rezepte bringen (für Karten & Detail-Sheet). */
export function catalogAsSaved(r: CatalogRecipe): SavedRecipe {
  return {
    id: r.id,
    user_id: 'catalog',
    author_name: null,
    title: r.title,
    servings: r.servings,
    ingredients: r.ingredients,
    steps: r.steps,
    kcal: r.kcal,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    sugar: r.sugar,
    sat_fat: r.sat_fat,
    salt: r.salt,
    shared: false,
    created_at: '',
  }
}
