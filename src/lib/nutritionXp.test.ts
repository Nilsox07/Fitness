import { describe, expect, it } from 'vitest'
import {
  computeNutritionXp,
  nutritionDailyQuests,
  nutritionStreak,
} from './nutritionXp'
import type { FoodEntry } from '../types'

const e = (date: string, kcal: number, protein: number) =>
  ({ date, kcal, protein }) as FoodEntry

describe('nutritionStreak', () => {
  it('zählt aufeinanderfolgende Tage bis heute', () => {
    const dates = new Set(['2026-09-16', '2026-09-17', '2026-09-18'])
    expect(nutritionStreak(dates, '2026-09-18')).toBe(3)
  })
  it('Kulanz: heute noch nicht geloggt → ab gestern', () => {
    const dates = new Set(['2026-09-16', '2026-09-17'])
    expect(nutritionStreak(dates, '2026-09-18')).toBe(2)
  })
  it('Lücke bricht den Streak', () => {
    const dates = new Set(['2026-09-14', '2026-09-18'])
    expect(nutritionStreak(dates, '2026-09-18')).toBe(1)
  })
})

describe('computeNutritionXp', () => {
  it('belohnt geloggte Tage, Eiweißtage und Streak', () => {
    const entries = [e('2026-09-17', 2000, 150), e('2026-09-18', 2000, 100)]
    // 2 Tage geloggt (40) + 1 Eiweißtag>=150 (15) + Streak 2 (40) = 95
    expect(computeNutritionXp(entries, 150, '2026-09-18')).toBe(95)
  })
})

describe('nutritionDailyQuests', () => {
  it('markiert Eiweiß- und Wasserziel als erreicht', () => {
    const q = nutritionDailyQuests({
      loggedToday: true,
      protein: 160,
      proteinTarget: 150,
      kcal: 2100,
      kcalTarget: 2000,
      waterMl: 2500,
      waterTarget: 2500,
    })
    const byId = Object.fromEntries(q.map((x) => [x.id, x.done]))
    expect(byId.nlog).toBe(true)
    expect(byId.nprot).toBe(true)
    expect(byId.nwater).toBe(true)
    expect(byId.nkcal).toBe(true) // |2100-2000| <= 200
  })
})
