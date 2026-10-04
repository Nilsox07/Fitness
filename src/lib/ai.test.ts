import { describe, expect, it } from 'vitest'
import { num, parseJson } from './ai'

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
