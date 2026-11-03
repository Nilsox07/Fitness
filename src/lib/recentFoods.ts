// „Zuletzt gegessen“, aber schlau: passend zur Mahlzeit, oft Gegessenes vor Einmaligem, heute schon
// Gegessenes (z. B. das gleiche Mittag wie Frühstück) ganz oben. Dazu „Wie gestern“ für eine ganze Mahlzeit.
// Reine Logik – getestet in recentFoods.test.ts.

import type { FoodEntry, Meal } from '../types'

export interface RecentFood {
  /** letzter Eintrag als Vorlage (Menge, Nährwerte) */
  entry: FoodEntry
  /** wie oft in den letzten Wochen */
  count: number
  /** heute schon gegessen (in einer anderen Mahlzeit) */
  today: boolean
}

const DAY = 86_400_000
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / DAY)
const keyOf = (e: FoodEntry) => e.name.trim().toLowerCase()

/**
 * Vorschläge für eine Mahlzeit, beste zuerst.
 * Punkte je Vorkommen: gleiche Mahlzeit 1, andere 0,35 – halbiert sich alle 14 Tage.
 * Heute in einer anderen Mahlzeit gegessen: großer Bonus. Heute schon in *dieser* Mahlzeit: weit nach hinten.
 */
export function recentFoods(
  entries: readonly FoodEntry[],
  meal: Meal,
  today: string,
  opts: { days?: number; limit?: number } = {},
): RecentFood[] {
  const days = opts.days ?? 60
  const limit = opts.limit ?? 12
  const acc = new Map<string, { entry: FoodEntry; score: number; count: number; today: boolean; inMeal: boolean }>()

  for (const e of entries) {
    if (!e.name?.trim()) continue
    const age = dayDiff(e.date, today)
    if (age < 0 || age > days) continue
    const k = keyOf(e)
    const m = e.meal ?? 'snack'
    const cur = acc.get(k) ?? { entry: e, score: 0, count: 0, today: false, inMeal: false }
    cur.score += (m === meal ? 1 : 0.35) * Math.pow(0.5, age / 14)
    cur.count += 1
    // neuester Eintrag ist die Vorlage
    if (e.date > cur.entry.date || (e.date === cur.entry.date && e.created_at >= cur.entry.created_at)) cur.entry = e
    if (age === 0) {
      if (m === meal) cur.inMeal = true
      else cur.today = true
    }
    acc.set(k, cur)
  }

  return [...acc.values()]
    .map((x) => ({ ...x, rank: x.score + (x.today && !x.inMeal ? 3 : 0) - (x.inMeal ? 5 : 0) }))
    .sort((a, b) => b.rank - a.rank || b.entry.created_at.localeCompare(a.entry.created_at))
    .slice(0, limit)
    .map(({ entry, count, today: t, inMeal }) => ({ entry, count, today: t && !inMeal }))
}

export interface MealCopy {
  date: string
  /** „gestern“, „vorgestern“ oder Wochentag */
  label: string
  items: FoodEntry[]
  kcal: number
}

/** Letzte Mahlzeit gleicher Art aus den vergangenen 7 Tagen (für „Wie gestern“). */
export function lastMealCopy(entries: readonly FoodEntry[], meal: Meal, today: string): MealCopy | null {
  let best: string | null = null
  for (const e of entries) {
    if ((e.meal ?? 'snack') !== meal || e.date >= today) continue
    const age = dayDiff(e.date, today)
    if (age > 7) continue
    if (!best || e.date > best) best = e.date
  }
  if (!best) return null
  const items = entries.filter((e) => e.date === best && (e.meal ?? 'snack') === meal)
  const age = dayDiff(best, today)
  const label =
    age === 1
      ? 'gestern'
      : age === 2
        ? 'vorgestern'
        : new Date(best + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' })
  return { date: best, label, items, kcal: Math.round(items.reduce((s, e) => s + e.kcal, 0)) }
}

/** Kurze Namensliste: „Haferflocken, Banane +2“. */
export function namesLine(items: readonly { name: string }[], max = 2): string {
  const names = items.map((i) => i.name)
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} +${names.length - max}`
}

/** Eintrag als neuer Eintrag (gleiche Menge) für Datum und Mahlzeit. */
export function repeatEntry(e: FoodEntry, date: string, meal: Meal) {
  return {
    date,
    meal,
    name: e.name,
    amount_g: e.amount_g,
    kcal: e.kcal,
    protein: e.protein,
    carbs: e.carbs,
    fat: e.fat,
    fiber: e.fiber ?? 0,
    sugar: e.sugar ?? 0,
    sat_fat: e.sat_fat ?? 0,
    salt: e.salt ?? 0,
    barcode: e.barcode,
    ...(e.fluid_ml ? { fluid_ml: e.fluid_ml } : {}),
  }
}
