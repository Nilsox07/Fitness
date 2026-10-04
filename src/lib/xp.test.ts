import { describe, expect, it } from 'vitest'
import { computeXp, cumulativeXp, dailyQuests, levelInfo, weeklyQuests } from './xp'
import type { SetType, SetWithDate } from '../types'

let c = 0
function s(date: string, exercise_id: string, set_type: SetType = 'working'): SetWithDate {
  c++
  return {
    id: `x${c}`,
    user_id: 'u',
    workout_id: `w-${date}`,
    exercise_id,
    set_number: 1,
    reps: 8,
    weight: 50,
    reps_right: null,
    weight_right: null,
    set_type,
    to_failure: true,
    created_at: `${date}T10:00:00Z`,
    date,
  }
}

describe('Level', () => {
  it('kumulatives XP wächst je Level', () => {
    expect(cumulativeXp(1)).toBe(0)
    expect(cumulativeXp(2)).toBe(100)
    expect(cumulativeXp(3)).toBe(300)
  })
  it('levelInfo bestimmt Level und Fortschritt', () => {
    expect(levelInfo(0).level).toBe(1)
    expect(levelInfo(150).level).toBe(2)
    expect(levelInfo(150).progress).toBe(25) // 50 von 200 im Level 2
  })
})

describe('dailyQuests', () => {
  it('markiert erledigte Tagesquests', () => {
    const today = '2026-09-16'
    const sets = [s(today, 'a'), s(today, 'b'), s(today, 'c')]
    const q = dailyQuests(sets, today)
    expect(q.find((x) => x.id === 'train')!.done).toBe(true)
    expect(q.find((x) => x.id === 'ex3')!.done).toBe(true)
    expect(q.find((x) => x.id === 'sets10')!.done).toBe(false)
  })
})

describe('leere Vorlagen-Sätze (0 Wdh)', () => {
  it('bringen kein XP und erfüllen keine Quest', () => {
    const today = '2026-09-16'
    const empty = { ...s(today, 'a'), reps: 0 }
    expect(computeXp([empty])).toBe(0)
    expect(dailyQuests([empty], today).find((x) => x.id === 'train')!.done).toBe(false)
    expect(weeklyQuests([empty], today).find((x) => x.id === 'w3')!.progress).toBe(0)
  })
})
