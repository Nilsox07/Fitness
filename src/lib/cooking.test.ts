import { describe, expect, it } from 'vitest'
import {
  ingredientKeywords,
  ingredientsInStep,
  fmtDurationShort,
  fmtQty,
  fmtTimer,
  parseQty,
  parseStepDuration,
  portionFactor,
  scaleIngredient,
} from './cooking'

describe('Nachkochen: Mengen', () => {
  it('liest Zahlen und Brüche', () => {
    expect(parseQty('1,5')).toBe(1.5)
    expect(parseQty('1/2')).toBe(0.5)
    expect(parseQty('½')).toBe(0.5)
    expect(parseQty('1½')).toBe(1.5)
    expect(parseQty('abc')).toBeNaN()
  })

  it('formatiert hübsch', () => {
    expect(fmtQty(0.5)).toBe('½')
    expect(fmtQty(1.5)).toBe('1½')
    expect(fmtQty(2.25)).toBe('2¼')
    expect(fmtQty(1.3333)).toBe('1,3')
    expect(fmtQty(12.4)).toBe('12')
    expect(fmtQty(400)).toBe('400')
  })

  it('skaliert die Menge vorn', () => {
    expect(scaleIngredient('200 g Mehl', 2)).toBe('400 g Mehl')
    expect(scaleIngredient('1/2 TL Salz', 3)).toBe('1½ TL Salz')
    expect(scaleIngredient('2–3 Eier', 2)).toBe('4–6 Eier')
    expect(scaleIngredient('1,5 EL Öl', 0.5)).toBe('¾ EL Öl')
    expect(scaleIngredient('  250g Quark', 0.5)).toBe('  125g Quark')
    expect(scaleIngredient('Salz nach Geschmack', 2)).toBe('Salz nach Geschmack')
    expect(scaleIngredient('200 g Mehl', 1)).toBe('200 g Mehl')
  })

  it('Faktor aus Portionen', () => {
    expect(portionFactor(4, 2)).toBe(2)
    expect(portionFactor(1, 0)).toBe(1)
    expect(portionFactor(3, 4)).toBe(0.75)
  })
})

describe('Nachkochen: Zeiten', () => {
  it('erkennt Minuten, Sekunden, Stunden', () => {
    expect(parseStepDuration('Nudeln 10 Min kochen')).toBe(600)
    expect(parseStepDuration('10 Minuten köcheln lassen.')).toBe(600)
    expect(parseStepDuration('30 Sek. umrühren')).toBe(30)
    expect(parseStepDuration('1 Std. 20 Min backen')).toBe(4800)
    expect(parseStepDuration('2 Minuten und 30 Sekunden')).toBe(150)
    expect(parseStepDuration('ca. 1,5 Stunden ruhen')).toBe(5400)
  })

  it('bei Spannen der kleinere Wert', () => {
    expect(parseStepDuration('10–15 Minuten garen')).toBe(600)
    expect(parseStepDuration('5 bis 8 Min. braten')).toBe(300)
  })

  it('keine Zeit → null, keine Fehltreffer', () => {
    expect(parseStepDuration('Ofen auf 180 °C vorheizen')).toBeNull()
    expect(parseStepDuration('5 Scheiben Brot toasten')).toBeNull()
    expect(parseStepDuration('2 Handvoll Spinat')).toBeNull()
  })

  it('Anzeige', () => {
    expect(fmtTimer(75)).toBe('1:15')
    expect(fmtTimer(3725)).toBe('1:02:05')
    expect(fmtTimer(-3)).toBe('0:00')
    expect(fmtDurationShort(30)).toBe('30 Sek')
    expect(fmtDurationShort(600)).toBe('10 Min')
    expect(fmtDurationShort(5400)).toBe('1 Std 30 Min')
  })
})

describe('Zutaten im Schritt', () => {
  const ing = [
    '60 g Haferflocken',
    '150 g Magerquark',
    '100 ml Milch (1,5 %)',
    '100 g Beerenmischung (TK)',
    '1 Prise Zimt',
    '2 EL Olivenöl',
  ]
  it('findet Zutaten auch über Wortteile', () => {
    expect(ingredientsInStep('Haferflocken, Quark, Milch und Zimt verrühren.', ing)).toEqual([
      '60 g Haferflocken',
      '150 g Magerquark',
      '100 ml Milch (1,5 %)',
      '1 Prise Zimt',
    ])
    expect(ingredientsInStep('Beeren darübergeben und kalt stellen.', ing)).toEqual(['100 g Beerenmischung (TK)'])
    expect(ingredientsInStep('Öl in der Pfanne erhitzen.', ing)).toEqual([])
    expect(ingredientsInStep('Das Olivenöl erhitzen.', ing)).toEqual(['2 EL Olivenöl'])
  })
  it('Kernwörter ohne Menge und Einheit', () => {
    expect(ingredientKeywords('150 g Magerquark (0,2 %)')).toEqual(['magerquark'])
    expect(ingredientKeywords('2 Zehen Knoblauch, gehackt')).toEqual(['knoblauch'])
  })
})
