import { describe, expect, it } from 'vitest'
import { fatLevelOf, toItems, withCookingFat } from './mealItems'
import type { FoodEstimate } from '../../lib/ai'

const food = (name: string, extra: Partial<FoodEstimate> = {}): FoodEstimate => ({
  name,
  amount_g: 150,
  kcal: 200,
  protein: 30,
  carbs: 0,
  fat: 8,
  fiber: 0,
  sugar: 0,
  sat_fat: 2,
  salt: 0.5,
  ...extra,
})

describe('Fett beim Zubereiten', () => {
  it('erkennt die Stufe aus dem KI-Posten', () => {
    expect(fatLevelOf(toItems([food('Hähnchen')], 'a'))).toBe(0)
    const items = toItems([food('Hähnchen'), food('Öl', { kind: 'cooking_fat', amount_g: 12, fat: 12 })], 'a')
    expect(fatLevelOf(items)).toBe(10)
  })

  it('ersetzt den Posten statt doppelt zu zählen', () => {
    const items = toItems([food('Hähnchen'), food('Öl', { kind: 'cooking_fat', amount_g: 12, fat: 12 })], 'a')
    const next = withCookingFat(items, 5)
    expect(next.filter((i) => i.base.kind === 'cooking_fat')).toHaveLength(1)
    expect(next.find((i) => i.base.kind === 'cooking_fat')!.base.kcal).toBe(45)
    expect(withCookingFat(next, 0).some((i) => i.base.kind === 'cooking_fat')).toBe(false)
  })
})
