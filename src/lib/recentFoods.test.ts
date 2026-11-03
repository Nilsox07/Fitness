import { describe, expect, it } from 'vitest'
import { lastMealCopy, namesLine, recentFoods, repeatEntry } from './recentFoods'
import type { FoodEntry, Meal } from '../types'

let n = 0
const e = (name: string, date: string, meal: Meal, extra: Partial<FoodEntry> = {}): FoodEntry => ({
  id: `id${++n}`,
  user_id: 'u',
  date,
  name,
  amount_g: 100,
  kcal: 200,
  protein: 10,
  carbs: 20,
  fat: 5,
  fiber: 2,
  sugar: 1,
  sat_fat: 1,
  salt: 0.1,
  barcode: null,
  meal,
  created_at: `${date}T08:00:${String(n % 60).padStart(2, '0')}Z`,
  ...extra,
})

const T = '2026-11-03'

describe('Zuletzt gegessen', () => {
  it('passende Mahlzeit und Häufigkeit zuerst', () => {
    const list = [
      e('Pizza', '2026-11-02', 'dinner'),
      e('Haferflocken', '2026-11-01', 'breakfast'),
      e('Haferflocken', '2026-11-02', 'breakfast'),
      e('Banane', '2026-10-20', 'breakfast'),
    ]
    const r = recentFoods(list, 'breakfast', T).map((x) => x.entry.name)
    expect(r[0]).toBe('Haferflocken')
    expect(r.indexOf('Banane')).toBeLessThan(r.indexOf('Pizza'))
  })

  it('heute schon gegessen (andere Mahlzeit) steht ganz oben – gleiches Mittag wie Frühstück', () => {
    const list = [
      e('Reis mit Hähnchen', '2026-11-01', 'lunch'),
      e('Reis mit Hähnchen', '2026-11-02', 'lunch'),
      e('Skyr', T, 'breakfast'),
    ]
    const r = recentFoods(list, 'lunch', T)
    expect(r[0].entry.name).toBe('Skyr')
    expect(r[0].today).toBe(true)
  })

  it('heute schon in dieser Mahlzeit → nach hinten', () => {
    const list = [e('Kaffee', T, 'breakfast'), e('Brot', '2026-11-02', 'breakfast')]
    expect(recentFoods(list, 'breakfast', T)[0].entry.name).toBe('Brot')
  })

  it('neuester Eintrag ist die Vorlage, Namen ohne Groß/Klein doppelt', () => {
    const list = [
      e('Skyr', '2026-11-01', 'snack', { amount_g: 150 }),
      e('skyr ', '2026-11-02', 'snack', { amount_g: 250 }),
    ]
    const r = recentFoods(list, 'snack', T)
    expect(r).toHaveLength(1)
    expect(r[0].entry.amount_g).toBe(250)
    expect(r[0].count).toBe(2)
  })

  it('zu alte und zukünftige Einträge zählen nicht', () => {
    const list = [e('Alt', '2026-08-01', 'lunch'), e('Morgen', '2026-11-04', 'lunch')]
    expect(recentFoods(list, 'lunch', T)).toHaveLength(0)
  })
})

describe('Wie gestern', () => {
  it('nimmt den letzten Tag mit dieser Mahlzeit', () => {
    const list = [
      e('Müsli', '2026-10-30', 'breakfast'),
      e('Haferflocken', '2026-11-02', 'breakfast'),
      e('Banane', '2026-11-02', 'breakfast'),
      e('Pizza', '2026-11-02', 'dinner'),
    ]
    const c = lastMealCopy(list, 'breakfast', T)!
    expect(c.label).toBe('gestern')
    expect(c.items.map((x) => x.name)).toEqual(['Haferflocken', 'Banane'])
    expect(c.kcal).toBe(400)
  })

  it('nichts innerhalb von 7 Tagen → null; heute zählt nicht', () => {
    expect(lastMealCopy([e('Alt', '2026-10-20', 'lunch')], 'lunch', T)).toBeNull()
    expect(lastMealCopy([e('Heute', T, 'lunch')], 'lunch', T)).toBeNull()
    expect(lastMealCopy([e('X', '2026-11-01', 'lunch')], 'lunch', T)!.label).toBe('vorgestern')
  })

  it('Hilfen', () => {
    expect(namesLine([{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }])).toBe('A, B +2')
    const r = repeatEntry(e('Wasser', '2026-11-01', 'snack', { fluid_ml: 500 }), T, 'lunch')
    expect(r).toMatchObject({ date: T, meal: 'lunch', name: 'Wasser', fluid_ml: 500 })
    expect('id' in r).toBe(false)
  })
})
