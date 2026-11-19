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
  /** Warum vorgeschlagen (Schnellauswahl): „Oft · 9×“, „Gestern zum Frühstück“ … */
  why?: string
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

/**
 * Name zum Zusammenfassen: KI und Suche benennen dasselbe Essen oft leicht anders
 * („Skyr (250 g)“, „Skyr, 250g“). Mengen, Klammern und Satzzeichen zählen nicht.
 */
export function foodKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\d+([.,]\d+)?\s*(g|gramm|ml|l|kcal|stk|stück|el|tl|portion(en)?)?\b/g, ' ')
    .replace(/[^a-zäöüß ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const MEAL_DAT: Record<Meal, string> = {
  breakfast: 'zum Frühstück',
  lunch: 'zum Mittag',
  dinner: 'zum Abendessen',
  snack: 'als Snack',
}

function whenLabel(date: string, today: string): string {
  const d = dayDiff(date, today)
  if (d === 0) return 'Heute'
  if (d === 1) return 'Gestern'
  if (d === 2) return 'Vorgestern'
  if (d < 7) return new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long' })
  return `Vor ${Math.round(d / 7)} Wo.`
}

/**
 * Schnellauswahl als Mischung, damit ein Ausreißer-Tag nichts verdrängt:
 * abwechselnd „zuletzt zu dieser Mahlzeit“, „oft in den letzten 6 Wochen“ und „zuletzt überhaupt“.
 * Was heute schon in dieser Mahlzeit steht, fällt raus. Jeder Vorschlag sagt, warum er da ist.
 */
export function quickPicks(
  entries: readonly FoodEntry[],
  meal: Meal,
  today: string,
  opts: { days?: number; limit?: number } = {},
): RecentFood[] {
  const days = opts.days ?? 42
  const limit = opts.limit ?? 12
  type Stat = {
    entry: FoodEntry
    last: string
    lastInMeal: string | null
    count: number
    inMealCount: number
    todayOther: boolean
    todayInMeal: boolean
  }
  const acc = new Map<string, Stat>()
  const newer = (a: FoodEntry, b: FoodEntry) => a.date > b.date || (a.date === b.date && a.created_at >= b.created_at)
  for (const e of entries) {
    if (!e.name?.trim()) continue
    const age = dayDiff(e.date, today)
    if (age < 0 || age > days) continue
    const k = foodKey(e.name) || keyOf(e)
    const m = e.meal ?? 'snack'
    const cur =
      acc.get(k) ??
      ({
        entry: e,
        last: e.date,
        lastInMeal: null,
        count: 0,
        inMealCount: 0,
        todayOther: false,
        todayInMeal: false,
      } as Stat)
    cur.count += 1
    if (newer(e, cur.entry)) cur.entry = e
    if (e.date > cur.last) cur.last = e.date
    if (m === meal) {
      cur.inMealCount += 1
      if (!cur.lastInMeal || e.date > cur.lastInMeal) cur.lastInMeal = e.date
      if (age === 0) cur.todayInMeal = true
    } else if (age === 0) cur.todayOther = true
    acc.set(k, cur)
  }
  const pool = [...acc.values()].filter((x) => !x.todayInMeal)
  const byDate = (a: string | null, b: string | null) => (b ?? '').localeCompare(a ?? '')
  const mealRecent = pool
    .filter((x) => x.lastInMeal)
    .sort((a, b) => byDate(a.lastInMeal, b.lastInMeal) || b.inMealCount - a.inMealCount)
  const frequent = pool
    .filter((x) => x.count >= 2)
    .sort((a, b) => b.inMealCount + b.count * 0.4 - (a.inMealCount + a.count * 0.4) || byDate(a.last, b.last))
  const recent = [...pool].sort((a, b) => byDate(a.last, b.last) || b.count - a.count)

  const out: RecentFood[] = []
  const seen = new Set<Stat>()
  const take = (x: Stat | undefined, why: string) => {
    if (!x || seen.has(x)) return
    seen.add(x)
    out.push({ entry: x.entry, count: x.count, today: x.todayOther, why })
  }
  // heute in einer anderen Mahlzeit gegessen (z. B. gleiches Mittag wie Frühstück) zuerst
  for (const x of recent.filter((r) => r.todayOther).slice(0, 2)) take(x, 'Heute schon gegessen')
  const lists: [Stat[], (x: Stat) => string][] = [
    [mealRecent, (x) => `${whenLabel(x.lastInMeal!, today)} ${MEAL_DAT[meal]}`],
    [frequent, (x) => `Oft · ${x.count}×`],
    [recent, (x) => `${whenLabel(x.last, today)} gegessen`],
  ]
  const idx = [0, 0, 0]
  while (out.length < limit && lists.some(([l], i) => idx[i] < l.length)) {
    lists.forEach(([l, why], i) => {
      while (idx[i] < l.length && seen.has(l[idx[i]])) idx[i]++
      if (out.length < limit && idx[i] < l.length) {
        const x = l[idx[i]++]
        take(x, why(x))
      }
    })
  }
  return out
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
    ...(e.micros ? { micros: e.micros } : {}),
  }
}
