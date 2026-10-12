import { describe, expect, it } from 'vitest'
import { outcome, outcomeText, ownValue, weekEnd, weekStartOf, type Challenge } from './stakes'
import { defaultRecapMonth, monthRecap } from './monthRecap'

const ch = (cv: number, ov: number): Challenge => ({
  id: 'c',
  creator: 'me',
  opponent: 'max',
  kind: 'sessions',
  target: 4,
  stake: '☕ Kaffee',
  week_start: '2026-10-12',
  status: 'active',
  creator_value: cv,
  opponent_value: ov,
  created_at: '',
})

const set = (date: string, ex = 'a') =>
  ({
    id: date + ex,
    user_id: 'u',
    workout_id: 'w',
    exercise_id: ex,
    set_number: 1,
    reps: 8,
    weight: 50,
    set_type: 'working',
    to_failure: false,
    created_at: '',
    date,
  }) as never

describe('Wetten', () => {
  it('Woche', () => {
    expect(weekStartOf('2026-10-15')).toBe('2026-10-12')
    expect(weekEnd('2026-10-12')).toBe('2026-10-18')
  })
  it('Ausgang', () => {
    expect(outcome(ch(2, 1), 'me', '2026-10-15')).toBe('running')
    expect(outcome(ch(4, 4), 'me', '2026-10-15')).toBe('both')
    expect(outcome(ch(4, 2), 'me', '2026-10-19')).toBe('me')
    expect(outcome(ch(4, 2), 'max', '2026-10-19')).toBe('them')
    expect(outcome(ch(1, 2), 'me', '2026-10-19')).toBe('none')
    expect(outcomeText('them', '☕ Kaffee', 'Max')).toContain('du schuldest')
  })
  it('eigener Stand', () => {
    const sets = [set('2026-10-12'), set('2026-10-12', 'b'), set('2026-10-14'), set('2026-10-20')]
    expect(ownValue('sessions', '2026-10-12', { sets, food: [], proteinTarget: 0 })).toBe(2)
  })
})

describe('Monats-Rückblick', () => {
  it('rechnet den Monat', () => {
    const r = monthRecap('2026-10', {
      sets: [set('2026-10-01', 'squat'), set('2026-10-03', 'squat'), set('2026-09-30', 'bench')],
      exerciseName: (id) => ({ squat: 'Kniebeuge', bench: 'Bankdrücken' })[id],
      food: [],
      proteinTarget: 0,
      weights: [
        { date: '2026-10-01', kg: 82 },
        { date: '2026-10-28', kg: 80.6 },
      ],
    })
    expect(r.sessions).toBe(2)
    expect(r.topExercise).toBe('Kniebeuge')
    expect(r.weightChange).toBe(-1.4)
    expect(r.monthName).toContain('Oktober')
  })
  it('in den ersten Tagen den Vormonat', () => {
    expect(defaultRecapMonth(new Date(2026, 10, 3))).toBe('2026-10')
    expect(defaultRecapMonth(new Date(2026, 10, 20))).toBe('2026-11')
  })
})
