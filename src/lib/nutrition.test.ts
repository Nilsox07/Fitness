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

describe('computeTargets — Ernährungsweise', () => {
  const base = {
    sex: 'm' as const, age: 30, height_cm: 180, weight_kg: 80, activity: 'moderate' as const,
  }
  const kcalOf = (t: { protein: number; carbs: number; fat: number }) => t.protein * 4 + t.carbs * 4 + t.fat * 9

  it('Ausgewogen = bisheriges Verhalten', () => {
    for (const goal of ['lose', 'maintain', 'gain', 'recomp'] as const) {
      expect(computeTargets({ ...base, goal, diet: 'balanced' })).toEqual(computeTargets({ ...base, goal }))
    }
  })

  it('High Protein: 2,2 g/kg, kcal unverändert', () => {
    const t = computeTargets({ ...base, goal: 'maintain', diet: 'high_protein' })
    expect(t.protein).toBe(176)
    expect(t.kcal).toBe(2759)
    // auch beim Aufbauen (sonst 2,0 g/kg)
    expect(computeTargets({ ...base, goal: 'gain', diet: 'high_protein' }).protein).toBe(176)
  })

  it('Low Carb: ~22 % der kcal aus KH, Fett füllt auf', () => {
    const t = computeTargets({ ...base, goal: 'maintain', diet: 'low_carb' })
    const share = (t.carbs * 4) / t.kcal
    expect(share).toBeGreaterThanOrEqual(0.2)
    expect(share).toBeLessThanOrEqual(0.25)
    expect(Math.abs(kcalOf(t) - t.kcal)).toBeLessThan(10)
  })

  it('Keto: KH ≤ 30 g, Fett füllt den Rest, Ziel-Logik bleibt', () => {
    const t = computeTargets({ ...base, goal: 'lose', diet: 'keto' })
    const ref = computeTargets({ ...base, goal: 'lose' })
    expect(t.carbs).toBeLessThanOrEqual(30)
    expect(t.kcal).toBe(ref.kcal)
    expect(t.protein).toBe(ref.protein)
    expect(t.fat).toBeGreaterThan(ref.fat)
    expect(Math.abs(kcalOf(t) - t.kcal)).toBeLessThan(10)
  })

  it('Mediterran: ~35 % Fett', () => {
    const t = computeTargets({ ...base, goal: 'maintain', diet: 'mediterranean' })
    expect((t.fat * 9) / t.kcal).toBeCloseTo(0.35, 1)
    expect(t.protein).toBe(144)
    expect(Math.abs(kcalOf(t) - t.kcal)).toBeLessThan(10)
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
