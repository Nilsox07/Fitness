import { describe, expect, it } from 'vitest'
import {
  intensityLevel,
  monthGrid,
  sessionMinutes,
  shiftMonth,
  weekGroupLabel,
  workoutMetas,
} from './progressUtils'
import type { SetWithDate } from '../../types'

function set(p: Partial<SetWithDate>): SetWithDate {
  return {
    id: Math.random().toString(36),
    user_id: 'u',
    workout_id: 'w',
    exercise_id: 'e',
    set_number: 1,
    reps: 10,
    weight: 50,
    reps_right: null,
    weight_right: null,
    set_type: 'working',
    to_failure: false,
    created_at: '2026-10-01T10:00:00Z',
    date: '2026-10-01',
    ...p,
  }
}

describe('weekGroupLabel', () => {
  const today = '2026-10-04' // Sonntag
  it('labels this and last week', () => {
    expect(weekGroupLabel('2026-09-28', today)).toBe('Diese Woche')
    expect(weekGroupLabel('2026-09-27', today)).toBe('Letzte Woche')
    expect(weekGroupLabel('2026-09-21', today)).toBe('Letzte Woche')
  })
  it('falls back to KW', () => {
    expect(weekGroupLabel('2026-09-16', today)).toBe('KW 38')
    expect(weekGroupLabel('2025-12-30', today)).toBe('KW 1')
    expect(weekGroupLabel('2025-12-20', today)).toBe('KW 51 · 2025')
  })
})

describe('sessionMinutes', () => {
  it('only plausible spans', () => {
    const a = { created_at: '2026-10-01T10:00:00Z' }
    expect(sessionMinutes([a, { created_at: '2026-10-01T11:05:00Z' }])).toBe(65)
    expect(sessionMinutes([a, { created_at: '2026-10-01T10:05:00Z' }])).toBeNull()
    expect(sessionMinutes([a, { created_at: '2026-10-01T16:00:00Z' }])).toBeNull()
    expect(sessionMinutes([a])).toBeNull()
  })
})

describe('workoutMetas', () => {
  it('counts PRs against earlier days only', () => {
    const sets = [
      set({ workout_id: 'a', date: '2026-09-01', weight: 50 }),
      set({ workout_id: 'b', date: '2026-09-05', weight: 55 }),
      set({ workout_id: 'b', date: '2026-09-05', weight: 52, exercise_id: 'x' }),
      set({ workout_id: 'c', date: '2026-09-08', weight: 54 }),
      set({ workout_id: 'c', date: '2026-09-08', reps: 0 }),
    ]
    const m = workoutMetas(sets)
    expect(m.get('a')!.prs).toBe(0)
    expect(m.get('b')!.prs).toBe(1)
    expect(m.get('b')!.exerciseIds).toHaveLength(2)
    expect(m.get('c')!.prs).toBe(0)
    expect(m.get('c')!.sets).toBe(1)
    expect(m.get('c')!.volume).toBe(540)
  })
})

describe('month helpers', () => {
  it('builds a Mo–So grid', () => {
    const g = monthGrid('2026-10') // 1.10. = Donnerstag
    expect(g[0]).toEqual([null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(g.every((r) => r.length === 7)).toBe(true)
    expect(g.flat().filter(Boolean)).toHaveLength(31)
  })
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
  it('intensity steps', () => {
    expect(intensityLevel(0, 100)).toBe(1)
    expect(intensityLevel(30, 100)).toBe(2)
    expect(intensityLevel(60, 100)).toBe(3)
    expect(intensityLevel(100, 100)).toBe(4)
  })
})
