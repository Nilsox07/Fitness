// Speisekarten großer Ketten mit recherchierten Nährwerten (Deutschland).
// Damit lassen sich Bestellungen ohne KI exakt eintragen, und der
// Budget-Vorschlag wird lokal berechnet (kostet nichts, ist sofort da).

import type { FoodEstimate } from './ai'

export interface MenuItem {
  name: string
  category: string
  amount_g: number | null
  kcal: number
  protein: number
  carbs: number
  fat: number
  sugar: number
  fiber: number
  sat_fat: number
  salt: number
  /** Quelle; „geschätzt", wenn keine offiziellen Werte gefunden wurden */
  src?: string
}

export interface Chain {
  id: string
  name: string
  items: MenuItem[]
}

/**
 * Eigenes Kürzel + Farbe je Kette (keine Original-Logos: Markenrechte und
 * App-Store-Regeln). Farben sind bewusst nur angelehnt.
 */
export const CHAIN_BADGE: Record<string, { name: string; short: string; bg: string; fg: string }> = {
  mcdonalds: { name: "McDonald's", short: 'Mc', bg: '#DA291C', fg: '#FFC72C' },
  burgerking: { name: 'Burger King', short: 'BK', bg: '#F5EBDC', fg: '#D62300' },
  kfc: { name: 'KFC', short: 'KFC', bg: '#A3080C', fg: '#FFFFFF' },
  subway: { name: 'Subway', short: 'Sub', bg: '#008C15', fg: '#FFC600' },
  dominos: { name: "Domino's", short: 'Do', bg: '#006491', fg: '#FFFFFF' },
  pizzahut: { name: 'Pizza Hut', short: 'PH', bg: '#C8102E', fg: '#FFFFFF' },
  nordsee: { name: 'Nordsee', short: 'NS', bg: '#003A70', fg: '#FFFFFF' },
  starbucks: { name: 'Starbucks', short: 'Sb', bg: '#00704A', fg: '#FFFFFF' },
  fiveguys: { name: 'Five Guys', short: '5G', bg: '#E31837', fg: '#FFFFFF' },
  dunkin: { name: "Dunkin'", short: 'Du', bg: '#FF671F', fg: '#FFFFFF' },
  deandavid: { name: 'dean&david', short: 'd&d', bg: '#1E1E1E', fg: '#C8D400' },
  vapiano: { name: 'Vapiano', short: 'Va', bg: '#E2001A', fg: '#FFFFFF' },
}

let cache: Promise<Chain[]> | null = null

/** Speisekarten laden (eigenes Bundle-Stück, erst bei Bedarf). */
export function loadChains(): Promise<Chain[]> {
  if (!cache) {
    cache = import('./fastfoodMenus.json').then((m) => (m.default as { chains: Chain[] }).chains)
    cache.catch(() => {
      cache = null
    })
  }
  return cache
}

/** Kette zu einem Anbieter-Namen (z. B. Chip „McDonald's"). */
export function findChain(chains: readonly Chain[], place: string): Chain | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const p = norm(place)
  return chains.find((c) => norm(c.name) === p || c.id === p)
}

/** Menü-Artikel × Menge als Schätzung (für das Analyse-Sheet). */
export function menuItemToEstimate(item: MenuItem, qty = 1): FoodEstimate {
  const r1 = (v: number) => Math.round((Number(v) || 0) * qty * 10) / 10
  return {
    name: qty === 1 ? item.name : `${qty}× ${item.name}`,
    amount_g: item.amount_g != null ? Math.round(item.amount_g * qty) : null,
    kcal: Math.round((Number(item.kcal) || 0) * qty),
    protein: r1(item.protein),
    carbs: r1(item.carbs),
    fat: r1(item.fat),
    fiber: r1(item.fiber),
    sugar: r1(item.sugar),
    sat_fat: r1(item.sat_fat),
    salt: Math.round((Number(item.salt) || 0) * qty * 100) / 100,
  }
}

const MAIN = /burger|chicken|wraps|subs|sandwich|pizza|pasta|fisch|bowl|salat|frühstück/i
const SIDE = /beilage/i
const DRINK = /getränk/i

/** Kalorienfreie Getränke (Zero, Light, Wasser, Kaffee schwarz, Tee). */
function isFreeDrink(i: MenuItem): boolean {
  return DRINK.test(i.category) && i.kcal <= 10
}

/**
 * Budget-Vorschlag ohne KI: ein Hauptgericht, optional eine Beilage und ein
 * kalorienfreies Getränk, sodass die kcal ins Rest-Budget passen. Bewertet
 * nach Eiweiß und danach, wie gut das Budget ausgenutzt wird.
 */
export function suggestCombo(items: readonly MenuItem[], remaining: { kcal: number; protein: number }): MenuItem[] {
  const budget = Math.max(0, remaining.kcal)
  const mains = items.filter((i) => MAIN.test(i.category) && i.kcal > 0)
  const sides = items.filter((i) => SIDE.test(i.category) && i.kcal > 0)
  const drink = items.find(isFreeDrink)
  if (mains.length === 0) return []

  let best: { combo: MenuItem[]; score: number } | null = null
  const consider = (combo: MenuItem[]) => {
    const kcal = combo.reduce((s, i) => s + i.kcal, 0)
    if (kcal > budget) return
    const protein = combo.reduce((s, i) => s + i.protein, 0)
    const useful = remaining.protein > 0 ? Math.min(protein, remaining.protein + 10) : protein
    const score = useful * 4 + (kcal / Math.max(budget, 1)) * 40 - combo.length * 2
    if (!best || score > best.score) best = { combo, score }
  }
  for (const m of mains) {
    consider([m])
    for (const s of sides) consider([m, s])
    for (const m2 of mains) if (m2 !== m && m2.name > m.name) consider([m, m2])
  }
  if (!best) {
    // Nichts passt ins Budget → kleinstes Hauptgericht als ehrliche Notlösung.
    const smallest = [...mains].sort((a, b) => a.kcal - b.kcal)[0]
    return drink ? [smallest, drink] : [smallest]
  }
  const combo = (best as { combo: MenuItem[] }).combo
  return drink ? [...combo, drink] : combo
}
