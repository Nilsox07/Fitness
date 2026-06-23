// Kostenlose, offene Lebensmittel-Datenbank (kein API-Key, keine KI).
// https://world.openfoodfacts.org

export interface FoodProduct {
  barcode: string | null
  name: string
  brand: string | null
  /** Nährwerte pro 100 g */
  per100: { kcal: number; protein: number; carbs: number; fat: number }
}

interface OffNutriments {
  ['energy-kcal_100g']?: number
  proteins_100g?: number
  carbohydrates_100g?: number
  fat_100g?: number
}

interface OffProduct {
  code?: string
  product_name?: string
  product_name_de?: string
  brands?: string
  nutriments?: OffNutriments
}

function normalize(p: OffProduct): FoodProduct {
  const n = p.nutriments ?? {}
  return {
    barcode: p.code ?? null,
    name: p.product_name_de || p.product_name || 'Unbenanntes Produkt',
    brand: p.brands ?? null,
    per100: {
      kcal: Math.round(n['energy-kcal_100g'] ?? 0),
      protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
    },
  }
}

const FIELDS = 'code,product_name,product_name_de,brands,nutriments'

/** Produkt per Barcode holen. null, wenn nicht gefunden. */
export async function fetchProductByBarcode(barcode: string): Promise<FoodProduct | null> {
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
