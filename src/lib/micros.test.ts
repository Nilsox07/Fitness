import { describe, expect, it } from 'vitest'
import { fmtMicro, lowest, microDay, normalizeMicros, scaleMicros } from './micros'

describe('Vitamine & Mineralstoffe', () => {
  it('liest robust: unbekannte Schlüssel weg, Ausreißer gekappt, leer = null', () => {
    expect(normalizeMicros({ vit_c: '45.27', iron: -1, foo: 3, calcium: 99999 })).toEqual({
      vit_c: 45.3,
      calcium: 2500,
    })
    expect(normalizeMicros({})).toBeNull()
    expect(normalizeMicros('x')).toBeNull()
  })

  it('skaliert mit der Portion', () => {
    expect(scaleMicros({ vit_c: 10, iron: 1.5 }, 2)).toEqual({ vit_c: 20, iron: 3 })
    expect(scaleMicros(null, 2)).toBeNull()
  })

  it('Tagessumme gegen DGE-Referenz, Frauen eigene Werte, Abdeckung nach kcal', () => {
    const day = microDay(
      [
        { kcal: 300, micros: { iron: 6, vit_c: 55 } },
        { kcal: 300, micros: { iron: 1.5 } },
        { kcal: 400, micros: null },
      ],
      'f',
    )!
    const iron = day.rows.find((r) => r.key === 'iron')!
    expect(iron.amount).toBe(7.5)
    expect(iron.target).toBe(15)
    expect(iron.share).toBeCloseTo(0.5)
    expect(day.coverage).toBeCloseTo(0.6)
    expect(microDay([{ kcal: 100 }], 'm')).toBeNull()
  })

  it('knappste Werte ohne Vitamin D', () => {
    const day = microDay([{ kcal: 500, micros: { vit_c: 100, iron: 2, calcium: 200 } }], 'm')!
    expect(lowest(day).map((r) => r.key)).not.toContain('vit_d')
    expect(lowest(day, 9, 0.5).every((r) => r.share < 0.5)).toBe(true)
  })

  it('Format', () => {
    expect(fmtMicro(2.25, 'mg')).toBe('2,3 mg')
    expect(fmtMicro(250, 'µg')).toBe('250 µg')
  })
})
