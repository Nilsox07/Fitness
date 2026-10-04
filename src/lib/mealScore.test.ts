import { describe, expect, it } from 'vitest'
import { scoreLabel, scoreMeal, type MealTotals } from './mealScore'

const meal = (p: Partial<MealTotals>): MealTotals => ({
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sat_fat: 0,
  salt: 0,
  ...p,
})

const texts = (r: ReturnType<typeof scoreMeal>) => r.highlights.map((h) => h.text)

describe('scoreLabel', () => {
  it('ordnet die Stufen korrekt zu', () => {
    expect(scoreLabel(100)).toEqual({ label: 'Sehr gut', tone: 'great' })
    expect(scoreLabel(80).tone).toBe('great')
    expect(scoreLabel(79).tone).toBe('good')
    expect(scoreLabel(65).tone).toBe('good')
    expect(scoreLabel(64).tone).toBe('ok')
    expect(scoreLabel(45).tone).toBe('ok')
    expect(scoreLabel(44)).toEqual({ label: 'Eher ungünstig', tone: 'poor' })
  })
})

describe('scoreMeal', () => {
  it('ist neutral ohne Energie', () => {
    const r = scoreMeal(meal({ kcal: 0 }))
    expect(r.score).toBe(50)
    expect(r.highlights).toEqual([])
  })

  it('bewertet Hähnchen mit Reis & Brokkoli sehr gut', () => {
    // 600 kcal, 55 g Eiweiß (9,2 g/100 kcal), 10 g Ballaststoffe (1,7/100 kcal)
    const r = scoreMeal(
      meal({ kcal: 600, protein: 55, carbs: 60, fat: 14, fiber: 10, sugar: 5, sat_fat: 3, salt: 1.5 }),
    )
    // 50 + 20 + 10 + 5 (sauber) = 85
    expect(r.score).toBe(85)
    expect(r.tone).toBe('great')
    expect(texts(r)).toEqual(['Viel Eiweiß', 'Ballaststoffreich'])
  })

  it('straft zuckrige, fettige Snacks ab', () => {
    // Donut: 450 kcal, 5 g Eiweiß, 30 g Zucker (27 %), 10 g ges. Fett (20 %), 0,8 g Salz
    const r = scoreMeal(meal({ kcal: 450, protein: 5, carbs: 50, fat: 25, sugar: 30, sat_fat: 10, salt: 0.8 }))
    // 50 − 5 (Eiweiß) − 15 (Zucker) − 10 (ges. Fett) − 0 (Salz 0,18/100 kcal) = 20
    expect(r.score).toBe(20)
    expect(r.label).toBe('Eher ungünstig')
    expect(texts(r)).toEqual(['Viel Zucker', 'Viel gesättigtes Fett'])
    expect(r.highlights.every((h) => h.kind === 'warn')).toBe(true)
  })

  it('erkennt salzige Mahlzeiten und bezieht kleine Portionen auf 100 kcal', () => {
    expect(texts(scoreMeal(meal({ kcal: 400, protein: 20, salt: 2.4 })))).toContain('Salzig')
    // 40 kcal mit 0,3 g Salz: gerechnet auf (mind.) 100 kcal → 0,3 g, also kein „Salzig"
    expect(texts(scoreMeal(meal({ kcal: 40, protein: 3, salt: 0.3 })))).not.toContain('Salzig')
  })

  it('bewertet das Tagesbudget je nach Ziel', () => {
    const big = meal({ kcal: 1200, protein: 60, fiber: 6 })
    const maintain = scoreMeal(big, { goal: 'maintain', remainingKcal: 500 })
    const lose = scoreMeal(big, { goal: 'lose', remainingKcal: 500 })
    const gain = scoreMeal(big, { goal: 'gain', remainingKcal: 500 })
    const free = scoreMeal(big)
    expect(maintain.score).toBe(free.score - 10)
    expect(lose.score).toBe(free.score - 15)
    expect(gain.score).toBe(free.score)
    expect(texts(maintain)).toContain('Sprengt dein Tagesbudget')
    expect(texts(gain)).not.toContain('Sprengt dein Tagesbudget')

    const fits = scoreMeal(meal({ kcal: 400, protein: 30 }), { remainingKcal: 900 })
    expect(texts(fits)).toContain('Passt in dein Tagesbudget')
  })

  it('berücksichtigt die Energiedichte nur beim Abnehmen', () => {
    const t = meal({ kcal: 300, protein: 20, fiber: 3 })
    const base = scoreMeal(t, { goal: 'lose' }).score
    expect(scoreMeal(t, { goal: 'lose', grams: 400 }).score).toBe(base + 5)
    expect(scoreMeal(t, { goal: 'lose', grams: 100 }).score).toBe(base - 5)
    expect(scoreMeal(t, { goal: 'maintain', grams: 100 }).score).toBe(scoreMeal(t).score)
  })

  it('bleibt im Bereich 0–100 und verträgt ungültige Werte', () => {
    const r = scoreMeal(meal({ kcal: 100, protein: NaN, sugar: 100, sat_fat: 50, salt: 10 }), {
      goal: 'lose',
      remainingKcal: -5000,
      grams: 10,
    })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

describe('scoreMeal — Ernährungsweise', () => {
  const bowl = meal({ kcal: 500, protein: 30, carbs: 40, fat: 20, fiber: 6, sugar: 5, sat_fat: 3, salt: 1 })
  const steak = meal({ kcal: 500, protein: 45, carbs: 5, fat: 34, fiber: 1, sugar: 1, sat_fat: 4, salt: 1 })

  it('ohne diet unverändert', () => {
    expect(scoreMeal(bowl, { diet: { macro: 'balanced', restrictions: [] } })).toEqual(scoreMeal(bowl))
  })

  it('Keto bestraft > 15 g KH je Mahlzeit', () => {
    const base = scoreMeal(bowl)
    const keto = scoreMeal(bowl, { diet: { macro: 'keto' } })
    expect(keto.score).toBe(base.score - 12)
    expect(texts(keto)).toContain('Zu viele KH für Keto')
    const ok = scoreMeal(steak, { diet: { macro: 'keto' } })
    expect(ok.score).toBe(scoreMeal(steak).score)
    expect(texts(ok)).toContain('Keto-tauglich')
  })

  it('Low Carb bestraft erst > 30 g KH', () => {
    expect(scoreMeal(bowl, { diet: { macro: 'low_carb' } }).score).toBe(scoreMeal(bowl).score - 8)
    const small = meal({ ...bowl, carbs: 25 })
    expect(scoreMeal(small, { diet: { macro: 'low_carb' } }).score).toBe(scoreMeal(small).score)
  })

  it('vegan/vegetarisch/pescetarisch: Warnung + Abzug bei tierischen Zutaten', () => {
    const base = scoreMeal(steak).score
    const vegan = scoreMeal(steak, { diet: { restrictions: ['vegan'] }, flags: { animal: 'dairy_egg' } })
    expect(vegan.score).toBe(base - 25)
    expect(vegan.highlights).toContainEqual({ kind: 'warn', text: 'Nicht vegan' })
    // Ei/Milch ist vegetarisch ok, Fisch pescetarisch ok
    expect(texts(scoreMeal(steak, { diet: { restrictions: ['vegetarian'] }, flags: { animal: 'dairy_egg' } }))).not.toContain('Nicht vegetarisch')
    expect(texts(scoreMeal(steak, { diet: { restrictions: ['vegetarian'] }, flags: { animal: 'fish' } }))).toContain('Nicht vegetarisch')
    expect(texts(scoreMeal(steak, { diet: { restrictions: ['pescetarian'] }, flags: { animal: 'fish' } }))).not.toContain('Nicht pescetarisch')
    expect(texts(scoreMeal(steak, { diet: { restrictions: ['pescetarian'] }, flags: { animal: 'meat' } }))).toContain('Nicht pescetarisch')
    // ohne Flags keine Warnung
    expect(scoreMeal(steak, { diet: { restrictions: ['vegan'] } }).score).toBe(base)
  })

  it('Unverarbeitet: Abzug bei starkem Verarbeitungsgrad', () => {
    const base = scoreMeal(bowl).score
    const r = scoreMeal(bowl, { diet: { restrictions: ['unprocessed'] }, flags: { processing: 4 } })
    expect(r.score).toBe(base - 10)
    expect(texts(r)).toContain('Stark verarbeitet')
    expect(scoreMeal(bowl, { diet: { restrictions: ['unprocessed'] }, flags: { processing: 3 } }).score).toBe(base - 4)
    // ohne die Einschränkung zählt die Verarbeitung nicht
    expect(scoreMeal(bowl, { flags: { processing: 4 } }).score).toBe(base)
  })
})
