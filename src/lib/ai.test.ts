import { describe, expect, it } from 'vitest'
import { num, parseJson, toMealAnalysis, toMealHighlights } from './ai'

describe('parseJson', () => {
  it('liest reines JSON', () => {
    expect(parseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
  })
  it('entfernt Code-Fences und Text drumherum', () => {
    expect(parseJson<{ a: number }>('Hier dein Plan:\n```json\n{"a":2}\n```\nViel Spaß!')).toEqual({ a: 2 })
    expect(parseJson<number[]>('Ergebnis: [1,2,3] fertig')).toEqual([1, 2, 3])
  })
  it('wirft eine deutsche Meldung bei abgeschnittener Antwort', () => {
    expect(() => parseJson('{"items":[{"name":"Reis"')).toThrow('unvollständig')
    expect(() => parseJson('')).toThrow('unvollständig')
  })
})

describe('num', () => {
  it('liest Zahlen aus Text', () => {
    expect(num(350)).toBe(350)
    expect(num('ca. 350')).toBe(350)
    expect(num('2,5')).toBe(2.5)
    expect(num('12 g')).toBe(12)
  })
  it('nutzt den Fallback statt NaN/null', () => {
    expect(num(null)).toBe(0)
    expect(num(undefined, 1)).toBe(1)
    expect(num('viel')).toBe(0)
    expect(num(Number.NaN)).toBe(0)
  })
})

describe('consistentKcal', () => {
  it('korrigiert nur deutlich zu niedrige Angaben', async () => {
    const { consistentKcal } = await import('./ai')
    expect(consistentKcal(300, 30, 40, 15)).toBe(415) // 4·30 + 4·40 + 9·15
    expect(consistentKcal(400, 30, 40, 15)).toBe(400) // innerhalb der Toleranz
    expect(consistentKcal(250, 0, 10, 0)).toBe(250) // z. B. Bier: Alkohol fehlt in den Makros
  })
})

describe('Mikronährstoff-Highlights', () => {
  it('nimmt max. 3 kurze Texte, ohne Dubletten und Unsinn', () => {
    expect(
      toMealHighlights([
        'Viel Vitamin C',
        ' Omega-3 ',
        'omega-3',
        42,
        '',
        'Viel zu langer Hinweistext hier',
        'Kalziumreich',
        'Gute Eisenquelle',
      ]),
    ).toEqual(['Viel Vitamin C', 'Omega-3', 'Kalziumreich'])
    expect(toMealHighlights('Viel Vitamin C')).toEqual([])
    expect(toMealHighlights(undefined)).toEqual([])
  })
  it('steckt in der Mahlzeit-Analyse nur, wenn vorhanden', () => {
    const base =
      '"title":"Lachs","verdict":"Gut.","items":[{"name":"Lachs","grams":150,"kcal":300,"protein":30,"carbs":0,"fat":20}]'
    expect(toMealAnalysis(`{${base},"highlights":["Omega-3"]}`).highlights).toEqual(['Omega-3'])
    expect(toMealAnalysis(`{${base},"highlights":[]}`)).not.toHaveProperty('highlights')
    expect(toMealAnalysis(`{${base}}`)).not.toHaveProperty('highlights')
  })
})
