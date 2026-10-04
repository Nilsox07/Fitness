// Hilfen für die Mahlzeit-Analyse: Zutaten skalieren (Gramm/Portion) und summieren.

import type { FoodEstimate } from '../../lib/ai'
import type { MealTotals } from '../../lib/mealScore'

/** Eine erkannte Zutat im Sheet: KI-Originalwerte + eigener Faktor (Gramm-Änderung). */
export interface MealItem {
  key: string
  base: FoodEstimate
  /** Faktor gegenüber der KI-Schätzung (z. B. 150 g statt 100 g → 1,5). */
  factor: number
}

export const PORTIONS = [
  { value: 0.5, label: '½' },
  { value: 1, label: '1' },
  { value: 1.5, label: '1½' },
  { value: 2, label: '2' },
] as const

const r0 = (v: number) => Math.round(v)
const r1 = (v: number) => Math.round(v * 10) / 10
const r2 = (v: number) => Math.round(v * 100) / 100

/** Schätzung mit Faktor skalieren (kcal ganzzahlig, Makros 0,1 g, Salz 0,01 g). */
export function scaleEstimate(e: FoodEstimate, f: number): FoodEstimate {
  return {
    name: e.name,
    amount_g: e.amount_g != null ? r0(e.amount_g * f) : null,
    kcal: r0(e.kcal * f),
    protein: r1(e.protein * f),
    carbs: r1(e.carbs * f),
    fat: r1(e.fat * f),
    fiber: r1(e.fiber * f),
    sugar: r1(e.sugar * f),
    sat_fat: r1(e.sat_fat * f),
    salt: r2(e.salt * f),
  }
}

export function toItems(estimates: FoodEstimate[], prefix: string): MealItem[] {
  return estimates.map((base, i) => ({
    key: `${prefix}-${i}`,
    base,
    factor: 1,
  }))
}

/** Effektive Werte einer Zutat inkl. Portionsfaktor. */
export function effective(item: MealItem, portion: number): FoodEstimate {
  return scaleEstimate(item.base, item.factor * portion)
}

export function totalsOf(list: FoodEstimate[]): MealTotals & { grams: number | null } {
  const t = list.reduce<MealTotals>(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs,
      fat: a.fat + e.fat,
      fiber: a.fiber + e.fiber,
      sugar: a.sugar + e.sugar,
      sat_fat: a.sat_fat + e.sat_fat,
      salt: a.salt + e.salt,
    }),
    {
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sat_fat: 0,
      salt: 0,
    },
  )
  // Gesamtgewicht nur, wenn alle Zutaten eine Grammangabe haben
  const grams = list.length && list.every((e) => e.amount_g) ? list.reduce((s, e) => s + (e.amount_g ?? 0), 0) : null
  return {
    kcal: r0(t.kcal),
    protein: r1(t.protein),
    carbs: r1(t.carbs),
    fat: r1(t.fat),
    fiber: r1(t.fiber),
    sugar: r1(t.sugar),
    sat_fat: r1(t.sat_fat),
    salt: r2(t.salt),
    grams,
  }
}

/** Zahl deutsch formatieren (max. 1 Nachkommastelle, Salz 2). */
export function fmt(v: number, digits = 1): string {
  return v.toLocaleString('de-DE', { maximumFractionDigits: digits })
}
