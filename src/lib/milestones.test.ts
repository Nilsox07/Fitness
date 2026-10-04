import { describe, expect, it } from 'vitest'
import { hasEverSetRecord, longestWeekStreak, milestones } from './milestones'
import type { SetWithDate } from '../types'

let c = 0
function s(date: string, weight = 50, reps = 8, exercise_id = 'bench'): SetWithDate {
  c++
  return {
    id: `x${c}`,
    user_id: 'u',
    workout_id: `w-${date}`,
    exercise_id,
    set_number: 1,
    reps,
    weight,
    reps_right: null,
    weight_right: null,
    set_type: 'working',
    to_failure: false,
    created_at: `${date}T10:00:00Z`,
    date,
  }
}

describe('longestWeekStreak', () => {
  it('zählt die längste Folge aufeinanderfolgender Wochen', () => {
    // KW: 31.08., 07.09., 14.09. (3 am Stück), Lücke, 05.10.
    const dates = ['2026-09-01', '2026-09-02', '2026-09-08', '2026-09-20', '2026-10-06']
    expect(longestWeekStreak(dates)).toBe(3)
  })
  it('über den Jahreswechsel', () => {
    expect(longestWeekStreak(['2025-12-24', '2025-12-31', '2026-01-07'])).toBe(3)
  })
  it('leer → 0', () => {
    expect(longestWeekStreak([])).toBe(0)
  })
})

describe('hasEverSetRecord', () => {
  it('erkennt eine Steigerung ggü. früheren Tagen', () => {
    expect(hasEverSetRecord([s('2026-09-01', 50), s('2026-09-03', 55)])).toBe(true)
  })
  it('erstes Training einer Übung ist kein Rekord', () => {
    expect(hasEverSetRecord([s('2026-09-01', 50), s('2026-09-01', 60)])).toBe(false)
  })
  it('gleich oder schwächer ist kein Rekord; leere Sätze zählen nicht', () => {
    expect(hasEverSetRecord([s('2026-09-01', 50), s('2026-09-03', 50), s('2026-09-05', 90, 0)])).toBe(false)
  })
})

describe('milestones', () => {
  it('liefert höchstens 8 Meilensteine', () => {
    expect(milestones([]).length).toBeLessThanOrEqual(8)
    expect(milestones([]).every((m) => !m.done)).toBe(true)
  })
  it('markiert erreichte Meilensteine', () => {
    const done = new Set(
      milestones([s('2026-09-01', 80), s('2026-09-08', 100)])
        .filter((m) => m.done)
        .map((m) => m.id),
    )
    expect(done).toEqual(new Set(['first', 'pr', 'kg100']))
  })
})
