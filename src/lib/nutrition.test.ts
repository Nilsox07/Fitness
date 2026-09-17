import { describe, expect, it } from 'vitest'
import { computeTargets, defaultWaterTarget, scalePer100, sumEntries } from './nutrition'

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

  it('Body Recomposition: leichtes Defizit (~200) + mehr Eiweiß (2,2 g/kg)', () => {
    const base = {
      sex: 'm' as const, age: 30, height_cm: 180, weight_kg: 80, activity: 'moderate' as const,
    }
    const maintain = computeTargets({ ...base, goal: 'maintain' })
    const recomp = computeTargets({ ...base, goal: 'recomp' })
    expect(maintain.kcal - recomp.kcal).toBe(200)
    expect(recomp.protein).toBe(176) // 2.2 × 80
  })
})

describe('defaultWaterTarget', () => {
  it('~35 ml/kg auf 250 ml gerundet, Untergrenze 1500', () => {
    expect(defaultWaterTarget(80)).toBe(2750) // 2800 → 2750
    expect(defaultWaterTarget(30)).toBe(1500) // Untergrenze
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
