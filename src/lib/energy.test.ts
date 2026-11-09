import { describe, expect, it } from 'vitest'
import { activityTarget, bmr, dayNeed, hasBody, stepsFor, stepsKcal, type BodyData } from './energy'

const man: BodyData = { sex: 'm', age: 30, height_cm: 180, weight_kg: 80, activity: 'moderate', goal: 'maintain' }

describe('Tagesbedarf nach Aktivität', () => {
  it('Grundumsatz nach Mifflin-St Jeor', () => {
    expect(bmr(man)).toBe(1780)
    expect(bmr({ ...man, sex: 'f' })).toBe(1614)
  })

  it('Schritte über 4000 zählen extra', () => {
    expect(stepsKcal(3000, 80)).toBe(0)
    expect(stepsKcal(10000, 80)).toBeCloseTo(240)
  })

  it('Bedarf = Grundumsatz + Alltag + Training + Verdauung', () => {
    const n = dayNeed(man, 8000, 250)
    expect(n.source).toBe('steps')
    expect(n.everyday).toBe(338) // 178 + 160
    expect(n.digestion).toBe(237)
    expect(n.total).toBe(2600)
    // ohne Schritte: Alltags-Einstellung
    const s = dayNeed(man, null, 0)
    expect(s.source).toBe('setting')
    expect(s.total).toBe(2350)
  })

  it('Ziel: Training halb, Ziel-Anpassung, Untergrenze', () => {
    const keep = activityTarget(man, 8000, 400)
    expect(keep).toBe(Math.round(dayNeed(man, 8000, 200).total / 10) * 10)
    expect(activityTarget({ ...man, goal: 'lose' }, 8000, 400)).toBe(keep - 500)
    const tiny: BodyData = { sex: 'f', age: 70, height_cm: 150, weight_kg: 45, activity: 'sedentary', goal: 'lose' }
    expect(activityTarget(tiny, 1000, 0)).toBe(1200)
  })

  it('heute mind. Ø der letzten 7 Tage, sonst echte Werte', () => {
    const m = new Map([
      ['2026-11-05', 8000],
      ['2026-11-06', 10000],
      ['2026-11-07', 9000],
      ['2026-11-09', 1200],
    ])
    expect(stepsFor('2026-11-09', '2026-11-09', m)).toBe(9000)
    expect(stepsFor('2026-11-06', '2026-11-09', m)).toBe(10000)
    expect(stepsFor('2026-11-01', '2026-11-09', m)).toBeNull()
    expect(stepsFor('2026-11-09', '2026-11-09', new Map([['2026-11-09', 500]]))).toBe(500)
  })

  it('Körperdaten vollständig?', () => {
    expect(hasBody(man)).toBe(true)
    expect(hasBody({ ...man, age: 0 })).toBe(false)
    expect(hasBody(null)).toBe(false)
  })
})
