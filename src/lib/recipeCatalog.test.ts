import { describe, expect, it } from 'vitest'
import { RECIPE_CATALOG, type CatalogRecipe } from './recipeCatalog'

const count = (pred: (r: CatalogRecipe) => boolean) => RECIPE_CATALOG.filter(pred).length
const formulaKcal = (r: CatalogRecipe) => 4 * r.protein + 4 * r.carbs + 9 * r.fat + 2 * r.fiber

describe('RECIPE_CATALOG', () => {
  it('hat mindestens 160 Rezepte mit eindeutigen, stabilen IDs und Titeln', () => {
    expect(RECIPE_CATALOG.length).toBeGreaterThanOrEqual(160)
    const ids = RECIPE_CATALOG.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^c-[a-z0-9]+(-[a-z0-9]+)*$/)
    const titles = RECIPE_CATALOG.map((r) => r.title.toLowerCase())
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('hat vollständige Rezeptdaten', () => {
    for (const r of RECIPE_CATALOG) {
      expect(r.meal.length, r.id).toBeGreaterThan(0)
      expect(r.ingredients.length, r.id).toBeGreaterThan(0)
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(2)
      expect(r.steps.length, r.id).toBeLessThanOrEqual(6)
      expect(r.servings, r.id).toBeGreaterThan(0)
      expect(r.minutes, r.id).toBeLessThanOrEqual(45)
      expect(new Set(r.meal).size, r.id).toBe(r.meal.length)
    }
    // Alltagstauglich: der Großteil ist in höchstens 30 Minuten fertig.
    expect(count((r) => r.minutes <= 30) / RECIPE_CATALOG.length).toBeGreaterThanOrEqual(0.9)
  })

  it('hat plausible Nährwerte', () => {
    for (const r of RECIPE_CATALOG) {
      expect(r.kcal, r.id).toBeGreaterThanOrEqual(100)
      expect(r.kcal, r.id).toBeLessThanOrEqual(1000)
      expect(r.sugar, r.id).toBeLessThanOrEqual(r.carbs)
      expect(r.sat_fat, r.id).toBeLessThanOrEqual(r.fat)
      expect(r.salt, r.id).toBeGreaterThanOrEqual(0)
      expect(r.salt, r.id).toBeLessThanOrEqual(4)
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
      if (r.macros.includes('low_fat')) expect((9 * r.fat) / r.kcal, r.id).toBeLessThanOrEqual(0.2)
    }
  })

  it('vegane Rezepte enthalten keine tierischen Zutaten', () => {
    const animal =
      /\b(Quark|Magerquark|Skyr|Hüttenkäse|Feta|Parmesan|Mozzarella|Gouda|Halloumi|Frischkäse|Käse|Butter|Kochsahne|Sahne|Milch|Kefir|Honig|Ei(?:er)?|Whey\S*|Hähnchen\S*|Pute\S*|Rind\S*|Schweine\S*|Kochschinken|Lachs\S*|Räucherlachs|Thunfisch|Garnelen|Kabeljau\S*|Seelachs\S*|Forelle\S*)\b|(Natur|griechischer )[Jj]oghurt/
    for (const r of RECIPE_CATALOG.filter((x) => x.restrictions.includes('vegan'))) {
      for (const ing of r.ingredients) expect(ing, r.id).not.toMatch(animal)
    }
  })

  it('vegetarische Rezepte enthalten kein Fleisch und keinen Fisch', () => {
    const meatFish =
      /(Hähnchen|Pute|Rinder|Rindfleisch|Schwein|Schinken|Speck|Hack|Lachs|Thunfisch|Garnelen|Kabeljau|Seelachs|Forelle)/
    for (const r of RECIPE_CATALOG.filter((x) => x.restrictions.includes('vegetarian'))) {
      for (const ing of r.ingredients) expect(ing, r.id).not.toMatch(meatFish)
    }
  })

  it('unverarbeitete Rezepte enthalten keine stark verarbeiteten Produkte', () => {
    const processed =
      /(Proteinpulver|Sojasauce|Tortilla|Gemüsebrühe|Kochschinken|Aufschnitt|Räucher|Schokolade|Gnocchi|Panko|Reiswaffel|Seitan|Zucker\b)/
    for (const r of RECIPE_CATALOG.filter((x) => x.restrictions.includes('unprocessed'))) {
      for (const ing of r.ingredients) expect(ing, r.id).not.toMatch(processed)
    }
  })

  it('vegan ⊂ vegetarisch ⊂ pescetarisch', () => {
    for (const r of RECIPE_CATALOG) {
      if (r.restrictions.includes('vegan')) expect(r.restrictions, r.id).toContain('vegetarian')
      if (r.restrictions.includes('vegetarian')) expect(r.restrictions, r.id).toContain('pescetarian')
    }
  })

  it('deckt Mahlzeiten und Ernährungsweisen ausreichend ab', () => {
    expect(count((r) => r.meal.includes('breakfast'))).toBeGreaterThanOrEqual(40)
    expect(count((r) => r.meal.includes('lunch') || r.meal.includes('dinner'))).toBeGreaterThanOrEqual(90)
    expect(count((r) => r.meal.includes('dinner') && r.minutes <= 15)).toBeGreaterThanOrEqual(20)
    expect(count((r) => r.meal.includes('snack'))).toBeGreaterThanOrEqual(40)
    expect(count((r) => r.restrictions.includes('vegan'))).toBeGreaterThanOrEqual(35)
    expect(count((r) => r.restrictions.includes('vegetarian'))).toBeGreaterThanOrEqual(80)
    expect(
      count((r) => r.restrictions.includes('pescetarian') && !r.restrictions.includes('vegetarian')),
    ).toBeGreaterThanOrEqual(18)
    expect(count((r) => !r.restrictions.includes('pescetarian'))).toBeGreaterThanOrEqual(35)
    expect(count((r) => r.restrictions.includes('unprocessed'))).toBeGreaterThanOrEqual(80)
    expect(count((r) => r.macros.includes('keto'))).toBeGreaterThanOrEqual(12)
    expect(count((r) => r.macros.includes('low_carb'))).toBeGreaterThanOrEqual(30)
    expect(count((r) => r.macros.includes('high_protein'))).toBeGreaterThanOrEqual(80)
    expect(count((r) => r.macros.includes('mediterranean'))).toBeGreaterThanOrEqual(35)
    expect(count((r) => r.macros.includes('low_fat'))).toBeGreaterThanOrEqual(20)
  })

  it('bietet leichte und deftige Kalorienstufen', () => {
    expect(count((r) => r.kcal >= 250 && r.kcal <= 450)).toBeGreaterThanOrEqual(5)
    expect(count((r) => r.kcal >= 700 && r.kcal <= 1000)).toBeGreaterThanOrEqual(5)
  })
})
