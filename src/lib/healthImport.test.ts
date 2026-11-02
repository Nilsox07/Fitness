import { describe, expect, it } from 'vitest'
import { isMissingColumn, waterImports, weightImports, withoutKeys } from './healthImport'

describe('Health-Connect-Übernahme', () => {
  it('Gewicht nur an Tagen ohne eigenen Eintrag, nur plausible Werte', () => {
    const r = weightImports(
      [
        { date: '2026-11-01', weight_kg: 80.04 },
        { date: '2026-10-31', weight_kg: 80.5 },
        { date: '2026-10-30', weight_kg: null },
        { date: '2026-10-29', weight_kg: 5 },
        { date: '2026-10-28' },
      ],
      ['2026-10-31'],
    )
    expect(r).toEqual([{ date: '2026-11-01', weight_kg: 80 }])
  })

  it('Wasser: das Größere gewinnt, nie verringern', () => {
    const app = new Map([
      ['2026-11-01', 1500],
      ['2026-10-31', 2500],
    ])
    const r = waterImports(
      [
        { date: '2026-11-01', hydration_ml: 2000 },
        { date: '2026-10-31', hydration_ml: 2000 },
        { date: '2026-10-30', hydration_ml: 1200 },
        { date: '2026-10-29', hydration_ml: null },
        { date: '2026-10-28', hydration_ml: 0 },
      ],
      app,
    )
    expect(r).toEqual([
      { date: '2026-11-01', ml: 2000, exists: true },
      { date: '2026-10-30', ml: 1200, exists: false },
    ])
  })

  it('fehlende Spalten erkennen und entfernen', () => {
    expect(isMissingColumn({ code: 'PGRST204' })).toBe(true)
    expect(isMissingColumn({ code: '42703' })).toBe(true)
    expect(isMissingColumn({ code: '23505', message: 'duplicate key' })).toBe(false)
    expect(isMissingColumn(null)).toBe(false)
    expect(withoutKeys([{ a: 1, hydration_ml: 2 }], ['hydration_ml'])).toEqual([{ a: 1 }])
  })
})
