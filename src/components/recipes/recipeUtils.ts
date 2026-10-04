// Reine Hilfen für die Rezept-Ansicht (neuer Modus): Cover-Farben aus dem Titel,
// Icon per Stichwort, Nährwerte pro Portion skalieren und „passt zu heute".

import {
  Beef,
  CakeSlice,
  ChefHat,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Wheat,
  type LucideIcon,
} from 'lucide-react'
import type { MealTotals } from '../../lib/mealScore'
import type { Meal, SavedRecipe } from '../../types'

/** Stabiler 32-bit-Hash (FNV-1a) — gleicher Titel → gleiche Farbe. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Kuratierte Farbtöne (warm, kräuterig, beerig) — keine grellen Neonfarben. */
const HUES = [12, 24, 36, 48, 88, 140, 165, 190, 215, 265, 300, 335]

/** Weicher Diagonal-Verlauf als CSS-Hintergrund (funktioniert hell & dunkel, Icon weiß). */
export function coverGradient(title: string): string {
  const h = hashString(title.trim().toLowerCase())
  const hue = HUES[h % HUES.length]
  const shift = 18 + ((h >>> 8) % 22) // 18–39° Verschiebung für Tiefe
  const hue2 = (hue + shift) % 360
  return `linear-gradient(135deg, hsl(${hue} 62% 64%) 0%, hsl(${hue2} 55% 46%) 100%)`
}

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/salat|salad|bowl|gemüse|veggie|buddha/i, Salad],
  [/suppe|soup|eintopf|curry|chili|ramen|brühe|dal\b/i, Soup],
  [/lachs|fisch|thunfisch|garnele|shrimp|fish|forelle|kabeljau|sushi/i, Fish],
  [/hähnchen|huhn|hühn|chicken|pute|truthahn|geflügel|wings/i, Drumstick],
  [/rind|steak|burger|hack|beef|bolognese|gulasch|schwein|lamm/i, Beef],
  [/omelett|rührei|\bei\b|eier|egg|frittata|shakshuka/i, Egg],
  [/pizza|flammkuchen/i, Pizza],
  [/wrap|sandwich|toast|burrito|taco|bagel|brot/i, Sandwich],
  [/shake|smoothie|drink|latte/i, CupSoda],
  [/kuchen|cake|muffin|brownie|dessert|pudding|quark|joghurt|eis\b|cookie|keks/i, CakeSlice],
  [/pancake|pfannkuchen|waffel|croissant|porridge|oats|haferflocken|müsli|granola/i, Croissant],
  [/pasta|nudel|spaghetti|reis|risotto|lasagne|gnocchi|couscous|quinoa/i, Wheat],
]

/** Passendes Icon zu Titel (und notfalls Zutaten); Standard: Kochmütze. */
export function recipeIcon(title: string, ingredients: readonly string[] = []): LucideIcon {
  for (const [re, icon] of ICON_RULES) if (re.test(title)) return icon
  const joined = ingredients.join(' ')
  for (const [re, icon] of ICON_RULES) if (re.test(joined)) return icon
  return ChefHat
}

/** Nährwerte einer Portion × Faktor (kcal ganzzahlig, Makros 0,1 g, Salz 0,01 g). */
export function recipeTotals(r: SavedRecipe, portions = 1): MealTotals {
  const r1 = (v: number) => Math.round((Number(v) || 0) * portions * 10) / 10
  return {
    kcal: Math.round((Number(r.kcal) || 0) * portions),
    protein: r1(r.protein),
    carbs: r1(r.carbs),
    fat: r1(r.fat),
    fiber: r1(r.fiber ?? 0),
    sugar: r1(r.sugar ?? 0),
    sat_fat: r1(r.sat_fat ?? 0),
    salt: Math.round((Number(r.salt) || 0) * portions * 100) / 100,
  }
}

/** Proteinreich: ≥ 30 g pro Portion oder ≥ 30 % der kcal aus Eiweiß. */
export function isHighProtein(r: SavedRecipe): boolean {
  return r.protein >= 30 || (r.kcal > 0 && (r.protein * 4) / r.kcal >= 0.3)
}

/**
 * Rezepte, die (1 Portion) noch in den Rest des Tages passen: kcal ≤ Rest und
 * mind. 120 kcal (keine Mini-Snacks). Sortiert nach Eiweiß-Beitrag zum offenen
 * Eiweiß-Rest, dann nach Eiweißdichte. Ohne Ziel/Rest → leere Liste.
 */
export function recipesForToday(
  recipes: readonly SavedRecipe[],
  remainingKcal: number | null,
  remainingProtein: number,
  limit = 8,
): SavedRecipe[] {
  if (remainingKcal == null || remainingKcal < 150) return []
  const fits = recipes.filter((r) => r.kcal >= 120 && r.kcal <= remainingKcal)
  const rank = (r: SavedRecipe) => {
    const useful = remainingProtein > 0 ? Math.min(r.protein, remainingProtein) : 0
    const density = r.kcal > 0 ? (r.protein / r.kcal) * 100 : 0
    return useful * 2 + density * 3
  }
  return [...fits].sort((a, b) => rank(b) - rank(a)).slice(0, limit)
}

/** Mahlzeit nach Uhrzeit (Vorauswahl beim Loggen). */
export function currentMeal(d = new Date()): Meal {
  const h = d.getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

/** Portionen hübsch: 0,5 → „½", 1,5 → „1½", 2 → „2". */
export function fmtPortions(p: number): string {
  const whole = Math.floor(p)
  const half = Math.abs(p - whole - 0.5) < 1e-9
  if (half) return whole === 0 ? '½' : `${whole}½`
  return p.toLocaleString('de-DE', { maximumFractionDigits: 2 })
}

/** Ernährungseintrag für `portions` Portionen eines Rezepts. */
export function recipeLogEntry(r: SavedRecipe, portions: number, meal: Meal, date: string) {
  const t = recipeTotals(r, portions)
  const suffix = portions === 1 ? '' : ` (${fmtPortions(portions)} Portionen)`
  return {
    date,
    name: `🍽️ ${r.title}${suffix}`,
    amount_g: null,
    kcal: t.kcal,
    protein: t.protein,
    carbs: t.carbs,
    fat: t.fat,
    fiber: t.fiber,
    sugar: t.sugar,
    sat_fat: t.sat_fat,
    salt: t.salt,
    barcode: null,
    meal,
  }
}
