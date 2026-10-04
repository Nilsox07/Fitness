import type { PlanDay, ShoppingCat } from '../../types'

// ---- Abhak-Liste (pro Plan) -------------------------------------------------
// Abgehakte Artikel gelten pro Plan (gespeicherte Plan-ID bzw. Erzeugungszeitpunkt
// eines neuen Plans) — ein neuer Plan startet mit leerer Liste.
const CHECKED_KEY = 'shopping_checked'

export function loadChecked(planKey: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(CHECKED_KEY) || 'null') as {
      plan?: string
      items?: string[]
    } | null
    return raw && !Array.isArray(raw) && raw.plan === planKey ? new Set(raw.items ?? []) : new Set()
  } catch {
    return new Set()
  }
}

export function saveChecked(planKey: string, s: Set<string>) {
  try {
    localStorage.setItem(CHECKED_KEY, JSON.stringify({ plan: planKey, items: [...s] }))
  } catch {
    /* ignore */
  }
}

/** Eindeutiger Schlüssel je Artikel: Kategorie + Name + Vorkommen (Duplikate getrennt). */
export function itemKeys(items: string[]): string[] {
  const seen = new Map<string, number>()
  return items.map((it) => {
    const n = seen.get(it) ?? 0
    seen.set(it, n + 1)
    return `${it}#${n}`
  })
}

/** Abhak-Schlüssel aller Artikel einer Kategorie (Format wie in der klassischen Ansicht). */
export function checkKeys(c: ShoppingCat): string[] {
  return itemKeys(c.items).map((k) => `${c.category}|${k}`)
}

// ---- Zuletzt gewählter Tab ------------------------------------------------------
export type PlanTab = 'plan' | 'shopping'
const TAB_KEY = 'mealplan_tab'

export function loadTab(): PlanTab {
  try {
    return localStorage.getItem(TAB_KEY) === 'shopping' ? 'shopping' : 'plan'
  } catch {
    return 'plan'
  }
}
export function saveTab(t: PlanTab) {
  try {
    localStorage.setItem(TAB_KEY, t)
  } catch {
    /* ignore */
  }
}

// ---- Tage -----------------------------------------------------------------------
const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']
const WEEKDAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** Wochentag-Index (0 = So) aus einem Tages-Label wie „Montag" / „Mo, Tag 1" — sonst -1. */
export function weekdayOf(label: string): number {
  const l = label.trim().toLowerCase()
  const full = WEEKDAYS.findIndex((w) => l.startsWith(w) || l.includes(w))
  if (full >= 0) return full
  return WEEKDAY_SHORT.findIndex((s) => new RegExp(`^${s.toLowerCase()}\\b`).test(l))
}

/** Kurzlabel für die Tagesleiste: „Mo" … oder „Tag". */
export function dayShort(label: string): string {
  const w = weekdayOf(label)
  return w >= 0 ? WEEKDAY_SHORT[w] : 'Tag'
}

/** Startauswahl: heutiger Wochentag, falls der Plan Wochentage nutzt — sonst Tag 1. */
export function initialDay(days: PlanDay[], now = new Date()): number {
  const i = days.findIndex((d) => weekdayOf(d.label) === now.getDay())
  return i >= 0 ? i : 0
}

export function dayTotals(d: PlanDay) {
  return d.meals.reduce(
    (a, m) => ({
      kcal: a.kcal + m.kcal,
      protein: a.protein + m.protein,
      carbs: a.carbs + m.carbs,
      fat: a.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  )
}

/** Ø kcal / Eiweiß pro Tag über den ganzen Plan. */
export function planAverages(days: PlanDay[]) {
  if (days.length === 0) return { kcal: 0, protein: 0 }
  const t = days.map(dayTotals)
  return {
    kcal: t.reduce((s, d) => s + d.kcal, 0) / days.length,
    protein: t.reduce((s, d) => s + d.protein, 0) / days.length,
  }
}

// ---- Einkaufsliste --------------------------------------------------------------
export type CatKind = 'meat' | 'fish' | 'egg' | 'dairy' | 'grain' | 'veg' | 'fruit' | 'nuts' | 'drinks' | 'other'

/** Kategorie-Art per Stichwort (für das Icon). */
export function categoryKind(category: string): CatKind {
  const c = category.toLowerCase()
  if (/fleisch|wurst|geflügel|hähnchen|huhn|pute|rind|metzger/.test(c)) return 'meat'
  if (/fisch|meeres|lachs|thunfisch/.test(c)) return 'fish'
  if (/^eier\b|^ei\b/.test(c)) return 'egg'
  if (/milch|molkerei|käse|joghurt|quark|kühl/.test(c)) return 'dairy'
  if (/eier/.test(c)) return 'egg'
  if (/obst|frücht|frucht|beeren/.test(c)) return 'fruit'
  if (/gemüse|salat|kräuter/.test(c)) return 'veg'
  if (/brot|back|getreide|nudel|pasta|reis|teigwaren|müsli|flocken|beilage|kohlenhydrat/.test(c)) return 'grain'
  if (/nüsse|nuss|samen|kerne/.test(c)) return 'nuts'
  if (/getränk/.test(c)) return 'drinks'
  return 'other'
}

/** Text zum Teilen: offene Artikel (oder alle, wenn alles erledigt ist) nach Kategorie. */
export function shoppingText(shopping: ShoppingCat[], checked: Set<string>): string {
  const open = shopping
    .map((c) => {
      const keys = checkKeys(c)
      return { category: c.category, items: c.items.filter((_, i) => !checked.has(keys[i])) }
    })
    .filter((c) => c.items.length)
  const list = open.length ? open : shopping.filter((c) => c.items.length)
  const body = list.map((c) => `${c.category}\n${c.items.map((i) => `• ${i}`).join('\n')}`).join('\n\n')
  return `Einkaufsliste\n\n${body}`
}
