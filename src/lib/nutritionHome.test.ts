import { describe, expect, it } from 'vitest'
import { filledGlasses, fmtInt, fmtLiters, kcalByDate, MEAL_SHARE, mealRecommendation, weekOf } from './nutritionHome'

describe('nutritionHome', () => {
  it('liefert die Woche Mo–So zu einem Datum', () => {
    // 2026-10-04 ist ein Sonntag
    expect(weekOf('2026-10-04')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(weekOf('2026-09-28')[0]).toBe('2026-09-28')
    expect(weekOf('2026-10-01')[6]).toBe('2026-10-04')
  })

  it('summiert kcal je Tag', () => {
    const m = kcalByDate([
      { date: '2026-10-01', kcal: 300 },
      { date: '2026-10-01', kcal: 200.4 },
      { date: '2026-10-02', kcal: 100 },
    ])
    expect(m.get('2026-10-01')).toBeCloseTo(500.4)
    expect(m.get('2026-10-02')).toBe(100)
    expect(kcalByDate(undefined).size).toBe(0)
  })

  it('verteilt das Tagesziel auf die Mahlzeiten', () => {
    const sum = Object.values(MEAL_SHARE).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
    expect(mealRecommendation('breakfast', 2400)).toBe(600)
    expect(mealRecommendation('snack', 2450)).toBe(250)
    expect(mealRecommendation('lunch', 0)).toBe(0)
  })

  it('formatiert Zahlen deutsch', () => {
    expect(fmtInt(1240)).toBe('1.240')
    expect(fmtInt(99.6)).toBe('100')
    expect(fmtLiters(1250)).toBe('1,25')
    expect(fmtLiters(2500)).toBe('2,5')
    expect(fmtLiters(0)).toBe('0')
    expect(fmtLiters(3000)).toBe('3')
  })

  it('zählt gefüllte Gläser', () => {
    expect(filledGlasses(0, 2500)).toBe(0)
    expect(filledGlasses(1250, 2500)).toBe(4)
    expect(filledGlasses(2500, 2500)).toBe(8)
    expect(filledGlasses(4000, 2500)).toBe(8)
    expect(filledGlasses(300, 2500)).toBe(0)
    expect(filledGlasses(500, 0)).toBe(0)
  })
})
