import { describe, expect, it } from 'vitest'
import { buddyLevelInfo, buddyXp, buddyXpParts, checkBuddyLevelUp, SEEN_BUDDY_LEVEL_KEY } from './buddyLevel'
import { computeXp, levelInfo } from './xp'
import { computeNutritionXp } from './nutritionXp'
import type { FoodEntry, SetWithDate } from '../types'

let c = 0
function s(date: string): SetWithDate {
  c++
  return {
    id: `x${c}`,
    user_id: 'u',
    workout_id: `w-${date}`,
    exercise_id: 'bench',
    set_number: 1,
    reps: 8,
    weight: 50,
    reps_right: null,
    weight_right: null,
    set_type: 'working',
    to_failure: true,
    created_at: `${date}T10:00:00Z`,
    date,
  }
}
const f = (date: string, protein: number) => ({ date, kcal: 2000, protein }) as FoodEntry

const sets = [s('2026-09-01'), s('2026-09-01'), s('2026-09-03')]
const food = [f('2026-09-01', 150), f('2026-09-02', 90), f('2026-09-03', 160)]

function memStorage(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init))
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    map: m,
  }
}

describe('buddyXp', () => {
  it('addiert Trainings- und Ernährungs-XP', () => {
    const parts = buddyXpParts({ sets, foodEntries: food, proteinTarget: 140, showNutrition: true })
    expect(parts.fitness).toBe(computeXp(sets))
    expect(parts.nutrition).toBe(computeNutritionXp(food, 140))
    expect(parts.nutrition).toBeGreaterThan(0)
    expect(parts.total).toBe(parts.fitness + parts.nutrition)
  })

  it('ohne Ernährungstracking zählt nur Training', () => {
    expect(buddyXp({ sets, foodEntries: food, proteinTarget: 140, showNutrition: false })).toBe(computeXp(sets))
  })

  it('leere Daten → Level 1', () => {
    const info = buddyLevelInfo({ sets: [], foodEntries: [], proteinTarget: 0, showNutrition: true })
    expect(info.level).toBe(1)
    expect(info.xp).toBe(0)
  })

  it('nutzt die bekannte Level-Kurve', () => {
    const i = { sets, foodEntries: food, proteinTarget: 140, showNutrition: true }
    expect(buddyLevelInfo(i)).toEqual(levelInfo(buddyXp(i)))
  })
})

describe('checkBuddyLevelUp', () => {
  it('erster Start: übernimmt den aktuellen Level ohne Feier', () => {
    const st = memStorage()
    expect(checkBuddyLevelUp(7, st)).toBe(false)
    expect(st.map.get(SEEN_BUDDY_LEVEL_KEY)).toBe('7')
  })

  it('feiert nur echte Aufstiege, genau einmal', () => {
    const st = memStorage({ [SEEN_BUDDY_LEVEL_KEY]: '3' })
    expect(checkBuddyLevelUp(3, st)).toBe(false)
    expect(checkBuddyLevelUp(4, st)).toBe(true)
    expect(checkBuddyLevelUp(4, st)).toBe(false)
  })

  it('gespeicherter Level sinkt nie (kein erneutes Konfetti beim Wiederaufstieg)', () => {
    const st = memStorage({ [SEEN_BUDDY_LEVEL_KEY]: '5' })
    expect(checkBuddyLevelUp(4, st)).toBe(false)
    expect(st.map.get(SEEN_BUDDY_LEVEL_KEY)).toBe('5')
    expect(checkBuddyLevelUp(5, st)).toBe(false)
    expect(checkBuddyLevelUp(6, st)).toBe(true)
  })

  it('ungültiger Wert wird wie ein erster Start behandelt', () => {
    const st = memStorage({ [SEEN_BUDDY_LEVEL_KEY]: 'abc' })
    expect(checkBuddyLevelUp(9, st)).toBe(false)
    expect(st.map.get(SEEN_BUDDY_LEVEL_KEY)).toBe('9')
  })
})
