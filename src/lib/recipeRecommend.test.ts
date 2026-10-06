import { describe, expect, it } from 'vitest'
import { DEFAULT_DIET } from './dietStyle'
import type { CatalogRecipe } from './recipeCatalog'
import { fitsDiet, recommendRecipes, type RecommendContext } from './recipeRecommend'

const r = (id: string, over: Partial<CatalogRecipe>): CatalogRecipe => ({
  id,
  title: id,
  meal: ['lunch'],
  minutes: 15,
  servings: 1,
  ingredients: [],
  steps: [],
  kcal: 500,
  protein: 30,
  carbs: 40,
  fat: 15,
  fiber: 5,
  sugar: 5,
  sat_fat: 3,
  salt: 1,
  restrictions: [],
  macros: ['balanced'],
  ...over,
})

const ctx = (over: Partial<RecommendContext> = {}): RecommendContext => ({
  goal: 'maintain',
  diet: DEFAULT_DIET,
  meal: 'lunch',
  remainingKcal: 1000,
  remainingProtein: 60,
  ...over,
})

describe('fitsDiet', () => {
  it('filtert nach Einschränkungen und Keto', () => {
    const vegan = { ...DEFAULT_DIET, restrictions: ['vegan' as const] }
    expect(fitsDiet(r('a', { restrictions: ['vegan', 'vegetarian'] }), vegan)).toBe(true)
    expect(fitsDiet(r('b', { restrictions: ['vegetarian'] }), vegan)).toBe(false)
    const keto = { ...DEFAULT_DIET, macro: 'keto' as const }
    expect(fitsDiet(r('c', { macros: ['low_carb'] }), keto)).toBe(false)
    expect(fitsDiet(r('d', { macros: ['keto', 'low_carb'] }), keto)).toBe(true)
  })
})

describe('recommendRecipes', () => {
  it('beim Abnehmen leichte, eiweißreiche Gerichte vorn', () => {
    const list = [r('heavy', { kcal: 950, protein: 35 }), r('light', { kcal: 420, protein: 38 })]
    expect(recommendRecipes(list, ctx({ goal: 'lose' }))[0].id).toBe('light')
  })
  it('beim Aufbau kräftige Gerichte vorn', () => {
    const list = [r('light', { kcal: 300, protein: 20 }), r('big', { kcal: 800, protein: 45 })]
    expect(recommendRecipes(list, ctx({ goal: 'gain' }))[0].id).toBe('big')
  })
  it('passende Mahlzeit schlägt unpassende', () => {
    const list = [r('dinner', { meal: ['dinner'] }), r('breakfast', { meal: ['breakfast'] })]
    expect(recommendRecipes(list, ctx({ meal: 'breakfast' }))[0].id).toBe('breakfast')
  })
  it('zu viel für das Rest-Budget rutscht nach hinten', () => {
    const list = [r('fits', { kcal: 400, protein: 25 }), r('toomuch', { kcal: 900, protein: 50 })]
    expect(recommendRecipes(list, ctx({ remainingKcal: 450 }))[0].id).toBe('fits')
  })
})
