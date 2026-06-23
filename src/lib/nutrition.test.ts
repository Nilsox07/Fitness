import { describe, expect, it } from 'vitest'
import { computeTargets, scalePer100, sumEntries } from './nutrition'

describe('computeTargets', () => {
  it('berechnet kcal & Makros (Mann, Halten)', () => {
    const t = computeTargets({
      sex: 'm',
      age: 30,
      height_cm: 180,
      weight_kg: 80,
      activity: 'moderate',
      goal: 'maintain',
    })
    // BMR 1780 × 1.55 = 2759
    expect(t.kcal).toBe(2759)
    expect(t.protein).toBe(144) // 1.8 × 80
    expect(t.fat).toBe(64) // 0.8 × 80
  })

  it('zieht beim Abnehmen 500 kcal ab', () => {
    const base = computeTargets({
      sex: 'm', age: 30, height_cm: 180, weight_kg: 80, activity: 'moderate', goal: 'maintain',
    })
    const lose = computeTargets({
      sex: 'm', age: 30, height_cm: 180, weight_kg: 80, activity: 'moderate', goal: 'lose',
    })
    expect(base.kcal - lose.kcal).toBe(500)
  })

  it('hält eine Untergrenze von 1200 kcal ein', () => {
    const t = computeTargets({
      sex: 'f', age: 60, height_cm: 150, weight_kg: 45, activity: 'sedentary', goal: 'lose',
    })
    expect(t.kcal).toBeGreaterThanOrEqual(1200)
  })
})

describe('sumEntries', () => {
  it('summiert Tageswerte', () => {
    const s = sumEntries([
      { kcal: 200, protein: 10, carbs: 20, fat: 5 },
      { kcal: 300.4, protein: 25, carbs: 30, fat: 10 },
    ])
    expect(s.kcal).toBe(500)
    expect(s.protein).toBe(35)
  })
})

describe('scalePer100', () => {
  it('skaliert Nährwerte auf die Menge', () => {
    const s = scalePer100({ kcal: 250, protein: 12, carbs: 30, fat: 8 }, 150)
    expect(s.kcal).toBe(375)
    expect(s.protein).toBe(18)
  })
})
