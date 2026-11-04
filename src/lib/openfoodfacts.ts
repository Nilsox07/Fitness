// Kostenlose, offene Lebensmittel-Datenbank (kein API-Key, keine KI).
// https://world.openfoodfacts.org

import { normalizeMicros, type MicroKey, type Micros } from './micros'
import { hintFoodMethod } from './track'

export interface FoodProduct {
  barcode: string | null
  name: string
  brand: string | null
  /** Getränk (Angaben pro 100 ml) → Menge zählt zur Trinkmenge */
  isDrink?: boolean
  /** Nährwerte pro 100 g */
  per100: {
    kcal: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    sugar: number
    sat_fat: number
    salt: number
    /** Vitamine & Mineralstoffe pro 100 g, falls auf der Packung angegeben */
    micros?: Micros
  }
}

// OFF liefert Vitamine/Mineralstoffe in Gramm pro 100 g → in mg bzw. µg umrechnen.
const OFF_MICROS: [MicroKey, string, number][] = [
  ['vit_c', 'vitamin-c_100g', 1000],
  ['vit_d', 'vitamin-d_100g', 1e6],
  ['vit_b12', 'vitamin-b12_100g', 1e6],
  ['folate', 'vitamin-b9_100g', 1e6],
  ['iron', 'iron_100g', 1000],
  ['calcium', 'calcium_100g', 1000],
  ['magnesium', 'magnesium_100g', 1000],
  ['zinc', 'zinc_100g', 1000],
  ['potassium', 'potassium_100g', 1000],
]

/** Vitamine aus den OFF-Nährwerten (pro 100 g); null wenn keine angegeben. */
export function offMicros(n: Record<string, unknown>): Micros | null {
  const raw: Record<string, number> = {}
  for (const [k, field, f] of OFF_MICROS) {
    const v = Number(n[field])
    if (Number.isFinite(v) && v > 0) raw[k] = v * f
  }
  return normalizeMicros(raw)
}

interface OffNutriments {
  ['energy-kcal_100g']?: number
  proteins_100g?: number
  carbohydrates_100g?: number
  fat_100g?: number
  fiber_100g?: number
  sugars_100g?: number
  ['saturated-fat_100g']?: number
  salt_100g?: number
}

interface OffProduct {
  code?: string
  product_name?: string
  product_name_de?: string
  brands?: string
  nutriments?: OffNutriments
  categories_tags?: string[]
  quantity?: string
  nutrition_data_per?: string
}

/** Getränk? Kategorie „beverages", Angaben pro 100 ml oder Packungsgröße in ml/l. */
function isBeverage(p: OffProduct): boolean {
  if ((p.categories_tags ?? []).some((t) => /beverages|getränke|boissons|drinks/.test(t))) return true
  if ((p.nutrition_data_per ?? '').includes('ml')) return true
  return /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '')
}

function normalize(p: OffProduct): FoodProduct {
  const n = p.nutriments ?? {}
  return {
    barcode: p.code ?? null,
    name: p.product_name_de || p.product_name || 'Unbenanntes Produkt',
    brand: p.brands ?? null,
    isDrink: isBeverage(p),
    per100: {
      kcal: Math.round(n['energy-kcal_100g'] ?? 0),
      protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      fiber: Math.round((n.fiber_100g ?? 0) * 10) / 10,
      sugar: Math.round((n.sugars_100g ?? 0) * 10) / 10,
      sat_fat: Math.round((n['saturated-fat_100g'] ?? 0) * 10) / 10,
      salt: Math.round((n.salt_100g ?? 0) * 100) / 100,
      ...(() => {
        const m = offMicros(n as Record<string, unknown>)
        return m ? { micros: m } : {}
      })(),
    },
  }
}

const FIELDS = 'code,product_name,product_name_de,brands,nutriments,categories_tags,quantity,nutrition_data_per'

/** Produkt per Barcode holen. null, wenn nicht gefunden. */
export async function fetchProductByBarcode(barcode: string): Promise<FoodProduct | null> {
  hintFoodMethod('barcode')
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
    barcode,
  )}.json?fields=${FIELDS}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Netzwerkfehler bei der Lebensmittel-Datenbank')
  const data = (await res.json()) as { status?: number; product?: OffProduct }
  if (data.status !== 1 || !data.product) return null
  return normalize(data.product)
}

/** Produkte nach Namen suchen (nur Treffer mit kcal-Angabe). */
export async function searchProducts(query: string): Promise<FoodProduct[]> {
  hintFoodMethod('search')
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Netzwerkfehler bei der Lebensmittel-Datenbank')
  const data = (await res.json()) as { products?: OffProduct[] }
  return (data.products ?? [])
    .map(normalize)
    .filter((p) => p.per100.kcal > 0)
}
