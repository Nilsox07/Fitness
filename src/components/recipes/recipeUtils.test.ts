import { describe, expect, it } from 'vitest'
import { ChefHat, Drumstick, Salad } from 'lucide-react'
import type { SavedRecipe } from '../../types'
import {
  coverGradient,
  fmtPortions,
  recipeIcon,
  recipeLogEntry,
  recipeTotals,
  recipesForToday,
} from './recipeUtils'

function recipe(p: Partial<SavedRecipe>): SavedRecipe {
  return {
    id: 'x',
    user_id: 'u',
    author_name: null,
    title: 'Test',
    servings: 1,
    ingredients: [],
    steps: [],
    kcal: 500,
    protein: 40,
    carbs: 50,
    fat: 15,
    fiber: 6,
    sugar: 5,
    sat_fat: 4,
    salt: 1.2,
    shared: false,
    created_at: '',
    ...p,
  }
}

describe('recipeUtils', () => {
  it('liefert stabile Verläufe je Titel', () => {
    expect(coverGradient('Chili')).toBe(coverGradient(' chili '))
    expect(coverGradient('Chili')).toMatch(/^linear-gradient/)
  })

  it('wählt Icons per Stichwort', () => {
    expect(recipeIcon('Griechischer Salat')).toBe(Salad)
    expect(recipeIcon('Hähnchen-Bowl mit Reis')).toBe(Salad)
    expect(recipeIcon('Schnelles Abendessen', ['200 g Hähnchenbrust'])).toBe(Drumstick)
    expect(recipeIcon('Irgendwas')).toBe(ChefHat)
  })

  it('skaliert Nährwerte mit den Portionen', () => {
    const t = recipeTotals(recipe({}), 1.5)
    expect(t.kcal).toBe(750)
    expect(t.protein).toBe(60)
    expect(t.salt).toBe(1.8)
  })

  it('baut Tagebuch-Einträge', () => {
    const e = recipeLogEntry(recipe({ title: 'Bowl' }), 2, 'lunch', '2026-10-04')
    expect(e.name).toBe('🍽️ Bowl (2 Portionen)')
    expect(e.kcal).toBe(1000)
    expect(recipeLogEntry(recipe({ title: 'Bowl' }), 1, 'lunch', '2026-10-04').name).toBe('🍽️ Bowl')
  })

  it('formatiert halbe Portionen', () => {
    expect(fmtPortions(0.5)).toBe('½')
    expect(fmtPortions(1.5)).toBe('1½')
    expect(fmtPortions(3)).toBe('3')
  })

  it('empfiehlt nur Rezepte, die in den Rest passen', () => {
    const list = [
      recipe({ id: 'a', kcal: 900, protein: 60 }),
      recipe({ id: 'b', kcal: 450, protein: 20 }),
      recipe({ id: 'c', kcal: 400, protein: 40 }),
      recipe({ id: 'd', kcal: 80, protein: 10 }),
    ]
    expect(recipesForToday(list, 600, 50).map((r) => r.id)).toEqual(['c', 'b'])
    expect(recipesForToday(list, null, 50)).toEqual([])
    expect(recipesForToday(list, 100, 50)).toEqual([])
  })
})
