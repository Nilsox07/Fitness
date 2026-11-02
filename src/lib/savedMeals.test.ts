import { describe, expect, it } from 'vitest'
import {
  defaultMealName,
  entriesFromSaved,
  itemsFromEntries,
  normalizeItems,
  savedMealTotals,
  sortSavedMeals,
  type SavedMeal,
} from './savedMeals'
import type { FoodEntry } from '../types'

const entry = (name: string, kcal: number, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: name,
  user_id: 'u',
  date: '2026-11-01',
  name,
  amount_g: 100,
  kcal,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 2,
  sugar: 1,
  sat_fat: 1,
  salt: 0.1,
  barcode: null,
  meal: 'breakfast',
  created_at: '',
  ...extra,
})

describe('Gespeicherte Mahlzeiten', () => {
  it('Einträge → Posten → Einträge (Datum und Mahlzeit neu)', () => {
    const items = itemsFromEntries([entry('Haferflocken', 370), entry('Milch', 64, { fluid_ml: 200, amount_g: null })])
    expect(items).toHaveLength(2)
    expect(items[0]).not.toHaveProperty('id')
    expect(items[1].fluid_ml).toBe(200)
    const back = entriesFromSaved(items, '2026-11-02', 'snack')
    expect(back[0]).toMatchObject({ date: '2026-11-02', meal: 'snack', name: 'Haferflocken', kcal: 370, amount_g: 100 })
    expect(back[1]).toMatchObject({ fluid_ml: 200, amount_g: null })
    expect(back[0]).not.toHaveProperty('fluid_ml')
  })

  it('Summe', () => {
    expect(savedMealTotals(itemsFromEntries([entry('a', 300.4), entry('b', 220)]))).toEqual({ kcal: 520, protein: 20 })
  })

  it('Namensvorschlag ohne Doppelung', () => {
    expect(defaultMealName('breakfast')).toBe('Mein Frühstück')
    expect(defaultMealName('lunch')).toBe('Mein Mittagessen')
    expect(defaultMealName('breakfast', ['mein frühstück', 'Mein Frühstück 2'])).toBe('Mein Frühstück 3')
  })

  it('kaputtes jsonb wird robust gelesen', () => {
    expect(normalizeItems(null)).toEqual([])
    const r = normalizeItems([{ name: 'Ei', kcal: '78.4', protein: -1 }, { kcal: 5 }, 'x'])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ name: 'Ei', kcal: 78, protein: 0, amount_g: null, barcode: null })
  })

  it('passende Mahlzeit zuerst, dann neueste', () => {
    const m = (id: string, meal: SavedMeal['meal'], created_at: string): SavedMeal => ({
      id,
      user_id: 'u',
      name: id,
      meal,
      items: [],
      created_at,
    })
    const list = [m('a', 'lunch', '2026-01-01'), m('b', 'breakfast', '2026-01-02'), m('c', 'lunch', '2026-01-03')]
    expect(sortSavedMeals(list, 'breakfast').map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(sortSavedMeals(list, null).map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })
})
