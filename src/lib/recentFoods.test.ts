import { describe, expect, it } from 'vitest'
import { foodKey, lastMealCopy, namesLine, quickPicks, recentFoods, repeatEntry } from './recentFoods'
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

describe('Schnellauswahl als Mischung', () => {
  const T2 = '2026-11-19'
  const d = (back: number) => {
    const x = new Date(T2 + 'T12:00:00')
    x.setDate(x.getDate() - back)
    return x.toISOString().slice(0, 10)
  }
  // sonst immer Skyr zum Frühstück, gestern mal Rührei, vorgestern Abend Pizza
  const hist = [
    ...[2, 3, 4, 5, 6, 8, 9, 10].map((b) => e('Skyr mit Beeren', d(b), 'breakfast')),
    e('Rührei', d(1), 'breakfast'),
    e('Pizza Margherita', d(2), 'dinner'),
    ...[3, 10, 17].map((b) => e('Haferflocken', d(b), 'breakfast')),
  ]

  it('ein anderer Tag verdrängt das Übliche nicht', () => {
    const r = quickPicks(hist, 'breakfast', T2)
    const names = r.map((x) => x.entry.name)
    expect(names.slice(0, 3)).toEqual(expect.arrayContaining(['Rührei', 'Skyr mit Beeren']))
    expect(names).toContain('Haferflocken')
    expect(r.find((x) => x.entry.name === 'Skyr mit Beeren')!.why).toMatch(/Oft · 8×/)
    expect(r.find((x) => x.entry.name === 'Rührei')!.why).toBe('Gestern zum Frühstück')
  })

  it('zuletzt überhaupt kommt auch vor (andere Mahlzeit)', () => {
    const r = quickPicks(hist, 'breakfast', T2)
    expect(r.find((x) => x.entry.name === 'Pizza Margherita')!.why).toBe('Vorgestern gegessen')
  })

  it('was heute schon in der Mahlzeit steht, fällt raus; andere Mahlzeit heute zuerst', () => {
    const r = quickPicks([...hist, e('Skyr mit Beeren', T2, 'breakfast'), e('Banane', T2, 'snack')], 'breakfast', T2)
    expect(r.some((x) => x.entry.name === 'Skyr mit Beeren')).toBe(false)
    expect(r[0]).toMatchObject({ why: 'Heute schon gegessen', today: true })
  })

  it('gleiches Essen mit anderer Schreibweise wird zusammengezählt', () => {
    expect(foodKey('Skyr (250 g)')).toBe(foodKey('Skyr, 250g'))
    expect(foodKey('2 Eier')).toBe('eier')
    const r = quickPicks([e('Skyr (250 g)', d(1), 'breakfast'), e('Skyr, 250g', d(2), 'breakfast')], 'breakfast', T2)
    expect(r).toHaveLength(1)
    expect(r[0].count).toBe(2)
  })
})
