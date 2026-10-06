import { describe, expect, it } from 'vitest'
import { RECIPE_CATALOG, type CatalogRecipe } from './recipeCatalog'

const count = (pred: (r: CatalogRecipe) => boolean) => RECIPE_CATALOG.filter(pred).length
const formulaKcal = (r: CatalogRecipe) => 4 * r.protein + 4 * r.carbs + 9 * r.fat + 2 * r.fiber

describe('RECIPE_CATALOG', () => {
  it('hat 48 Rezepte mit eindeutigen, stabilen IDs', () => {
    expect(RECIPE_CATALOG).toHaveLength(48)
    const ids = RECIPE_CATALOG.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^c-[a-z0-9-]+$/)
  })

  it('hat vollständige Rezeptdaten', () => {
    for (const r of RECIPE_CATALOG) {
      expect(r.meal.length, r.id).toBeGreaterThan(0)
      expect(r.ingredients.length, r.id).toBeGreaterThan(0)
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(2)
      expect(r.steps.length, r.id).toBeLessThanOrEqual(6)
      expect(r.servings, r.id).toBeGreaterThan(0)
      expect(r.minutes, r.id).toBeLessThanOrEqual(30)
    }
  })

  it('kcal passen zur Makro-Formel (±12 %)', () => {
    for (const r of RECIPE_CATALOG) {
      const diff = Math.abs(formulaKcal(r) - r.kcal) / r.kcal
      expect(diff, r.id).toBeLessThanOrEqual(0.12)
    }
  })

  it('Makro-Tags sind konsistent mit den Nährwerten', () => {
    for (const r of RECIPE_CATALOG) {
      if (r.macros.includes('keto')) expect(r.carbs, r.id).toBeLessThanOrEqual(10)
      if (r.macros.includes('low_carb')) expect(r.carbs, r.id).toBeLessThanOrEqual(25)
      if (r.macros.includes('high_protein')) {
        expect(r.protein >= 30 || (4 * r.protein) / r.kcal >= 0.25, r.id).toBe(true)
      }
    }
  })

  it('vegan ⊂ vegetarisch ⊂ pescetarisch', () => {
    for (const r of RECIPE_CATALOG) {
      if (r.restrictions.includes('vegan')) expect(r.restrictions, r.id).toContain('vegetarian')
      if (r.restrictions.includes('vegetarian')) expect(r.restrictions, r.id).toContain('pescetarian')
    }
  })

  it('deckt Mahlzeiten und Ernährungsweisen ausreichend ab', () => {
    expect(count((r) => r.meal.includes('breakfast'))).toBeGreaterThanOrEqual(12)
    expect(count((r) => r.meal.includes('lunch') || r.meal.includes('dinner'))).toBeGreaterThanOrEqual(24)
    expect(count((r) => r.meal.includes('dinner') && r.minutes <= 15)).toBeGreaterThanOrEqual(8)
    expect(count((r) => r.meal.includes('snack'))).toBeGreaterThanOrEqual(12)
    expect(count((r) => r.restrictions.includes('vegan'))).toBeGreaterThanOrEqual(12)
    expect(count((r) => r.restrictions.includes('vegetarian'))).toBeGreaterThanOrEqual(20)
    expect(
      count((r) => r.restrictions.includes('pescetarian') && !r.restrictions.includes('vegetarian')),
    ).toBeGreaterThanOrEqual(6)
    expect(count((r) => r.restrictions.includes('unprocessed'))).toBeGreaterThanOrEqual(14)
    expect(count((r) => r.macros.includes('keto'))).toBeGreaterThanOrEqual(8)
    expect(count((r) => r.macros.includes('low_carb'))).toBeGreaterThanOrEqual(14)
    expect(count((r) => r.macros.includes('high_protein'))).toBeGreaterThanOrEqual(20)
    expect(count((r) => r.macros.includes('mediterranean'))).toBeGreaterThanOrEqual(8)
  })

  it('bietet leichte und deftige Kalorienstufen', () => {
    expect(count((r) => r.kcal >= 250 && r.kcal <= 450)).toBeGreaterThanOrEqual(5)
    expect(count((r) => r.kcal >= 700 && r.kcal <= 1000)).toBeGreaterThanOrEqual(5)
  })
})
