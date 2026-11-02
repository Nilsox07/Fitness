import { describe, expect, it } from 'vitest'
import { cm, parseMeasureInput, signedCm, summarizeMeasurements, type MeasurementRow } from './measurements'

const row = (date: string, v: Partial<MeasurementRow>): MeasurementRow => ({
  date,
  waist: null,
  chest: null,
  arm: null,
  hip: null,
  thigh: null,
  ...v,
})

describe('summarizeMeasurements', () => {
  it('nur eingetragene Maße, Veränderung zur ersten Messung', () => {
    const s = summarizeMeasurements([
      row('2026-10-15', { waist: 94, arm: 35 }),
      row('2026-09-01', { waist: 96 }),
      row('2026-11-01', { waist: 92 }),
    ])
    expect(s.map((x) => x.key)).toEqual(['waist', 'arm'])
    expect(s[0]).toMatchObject({ label: 'Taille', latest: 92, first: 96, change: -4, latestDate: '2026-11-01' })
    expect(s[0].series).toEqual([96, 94, 92])
    expect(s[1]).toMatchObject({ latest: 35, change: 0, series: [35] })
  })
  it('leer → nichts; Zahlen als Text (numeric aus der DB) gehen', () => {
    expect(summarizeMeasurements([])).toEqual([])
    const s = summarizeMeasurements([row('2026-11-01', { hip: '101.5' as unknown as number })])
    expect(s[0]).toMatchObject({ key: 'hip', latest: 101.5 })
  })
})

describe('parseMeasureInput', () => {
  it('nur Ausgefülltes, Komma erlaubt, Unsinn als Fehler', () => {
    expect(parseMeasureInput({ waist: '92,5', chest: '', arm: ' ' })).toEqual({ values: { waist: 92.5 }, errors: [] })
    expect(parseMeasureInput({ waist: '5', thigh: 'abc' }).errors).toEqual(['waist', 'thigh'])
  })
})

describe('Formate', () => {
  it('cm und signedCm', () => {
    expect(cm(92)).toBe('92 cm')
    expect(cm(92.5)).toBe('92,5 cm')
    expect(signedCm(-4)).toBe('−4 cm')
    expect(signedCm(1.5)).toBe('+1,5 cm')
    expect(signedCm(0)).toBe('±0 cm')
  })
})
