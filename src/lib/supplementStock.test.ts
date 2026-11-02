import { describe, expect, it } from 'vitest'
import {
  dosesPerDay,
  fmtStock,
  guessDoseAmount,
  hasStockColumns,
  refill,
  refillReminderDate,
  stockDaysLeft,
  stockLabel,
  stockRemaining,
  stockStatus,
  takenSince,
  type StockSupplement,
} from './supplementStock'

const sup = (o: Partial<StockSupplement> = {}): StockSupplement => ({
  id: 'k',
  user_id: 'u',
  name: 'Kreatin',
  dose: '5 g',
  times: ['08:00'],
  days: [0, 1, 2, 3, 4, 5, 6],
  remind: true,
  position: 0,
  created_at: '',
  stock_amount: 100,
  stock_unit: 'g',
  dose_amount: 5,
  stock_set_at: '2026-11-01T06:00:00Z',
  ...o,
})

const log = (id: string, at: string) => ({ supplement_id: id, taken_at: at })

describe('Supplement-Vorrat', () => {
  it('Spalten erkennen (Migration gelaufen?)', () => {
    expect(hasStockColumns([{ id: 'a' }])).toBe(false)
    expect(hasStockColumns([{ id: 'a', stock_amount: null }])).toBe(true)
  })

  it('zählt nur Einnahmen seit dem Setzen, nur dieses Supplement', () => {
    const l = [
      log('k', '2026-10-31T08:00:00Z'), // vor dem Setzen
      log('k', '2026-11-01T08:00:00Z'),
      log('k', '2026-11-02T08:00:00Z'),
      log('x', '2026-11-02T08:00:00Z'),
    ]
    expect(takenSince(sup(), l)).toBe(2)
    expect(stockRemaining(sup(), 2)).toBe(90)
    expect(stockRemaining(sup(), 50)).toBe(0)
    expect(stockRemaining(sup({ stock_amount: null }), 2)).toBeNull()
    expect(stockRemaining(sup({ dose_amount: null, stock_unit: 'Stück' }), 3)).toBe(97)
  })

  it('Reichweite = Rest / (Einnahmen pro Tag × Dosis)', () => {
    expect(dosesPerDay({ times: ['08:00', '20:00'], days: [0, 2, 4] })).toBeCloseTo(6 / 7)
    expect(stockDaysLeft(90, sup())).toBe(18)
    expect(stockDaysLeft(90, sup({ times: ['08:00', '20:00'] }))).toBe(9)
    expect(stockDaysLeft(35, sup({ days: [0, 2, 4] }))).toBe(16) // 7 Einnahmen à 3/7 pro Tag
    expect(stockDaysLeft(10, sup({ times: [] }))).toBeNull()
  })

  it('Status und Text, knapp ab 7 Tagen', () => {
    const st = stockStatus(sup({ stock_amount: 40 }), [log('k', '2026-11-02T08:00:00Z')])
    expect(st).toEqual({ remaining: 35, days: 7, low: true })
    expect(stockLabel(st!)).toBe('reicht noch ca. 7 Tage')
    expect(stockStatus(sup(), [])!.low).toBe(false)
    expect(stockLabel({ remaining: 5, days: 1 })).toBe('reicht noch ca. 1 Tag')
    expect(stockLabel({ remaining: 2, days: 0 })).toBe('reicht nur noch heute')
    expect(stockLabel({ remaining: 0, days: 0 })).toBe('Vorrat leer')
    expect(stockStatus(sup({ stock_amount: null }), [])).toBeNull()
  })

  it('Nachfüllen addiert die neue Packung zum Rest', () => {
    expect(refill(12, 500)).toBe(512)
    expect(refill(-3, 100)).toBe(100)
  })

  it('Erinnerungs-Datum: Reichweite minus Vorlauf, frühestens heute', () => {
    expect(refillReminderDate(sup(), [], '2026-11-02')).toBe('2026-11-15') // 20 Tage − 7
    expect(refillReminderDate(sup({ stock_amount: 20 }), [], '2026-11-02')).toBe('2026-11-02')
    expect(refillReminderDate(sup({ stock_amount: null }), [], '2026-11-02')).toBeNull()
  })

  it('Anzeige und Dosis-Vorschlag', () => {
    expect(fmtStock(97.5, 'g')).toBe('97,5 g')
    expect(fmtStock(29.6, 'Stück')).toBe('29 Stück')
    expect(guessDoseAmount('5 g', 'g')).toBe(5)
    expect(guessDoseAmount('2 Kapseln', 'Stück')).toBe(2)
    expect(guessDoseAmount('1 Tabl.', 'Stück')).toBe(1)
    expect(guessDoseAmount('2000 IE', 'Stück')).toBeNull()
    expect(guessDoseAmount('5 g', 'ml')).toBeNull()
  })
})
