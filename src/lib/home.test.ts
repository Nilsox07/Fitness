import { describe, expect, it } from 'vitest'
import {
  estimateMinutes,
  lastSessionStats,
  recoveryLevel,
  sessionsInWeek,
  suggestNextPlan,
  weekDates,
} from './home'
import type { SetWithDate } from '../types'

function set(p: Partial<SetWithDate> & { exercise_id: string; date: string }): SetWithDate {
  return {
    id: Math.random().toString(36),
    user_id: 'u',
    workout_id: 'w-' + p.date,
    set_number: 1,
    reps: 8,
    weight: 50,
    reps_right: null,
    weight_right: null,
    set_type: 'working',
    to_failure: false,
    created_at: p.date + 'T10:00:00Z',
    ...p,
  }
}

describe('weekDates', () => {
  it('liefert Mo–So der Woche', () => {
    // 2026-10-04 ist ein Sonntag
    expect(weekDates('2026-10-04')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ])
    expect(weekDates('2026-09-28')[0]).toBe('2026-09-28')
  })

  it('zählt Trainingstage der Woche', () => {
    expect(sessionsInWeek(['2026-09-27', '2026-09-28', '2026-10-01', '2026-10-01'], '2026-10-04')).toBe(2)
  })
})

describe('estimateMinutes', () => {
  it('schätzt ~8,5 Min pro Übung, auf 5 aufgerundet', () => {
    expect(estimateMinutes(0)).toBe(0)
    expect(estimateMinutes(6)).toBe(55)
    expect(estimateMinutes(4)).toBe(35)
  })
})

describe('suggestNextPlan', () => {
  const plans = [
    { id: 'push', exercise_ids: ['bank', 'dips'] },
    { id: 'pull', exercise_ids: ['rudern', 'curls'] },
    { id: 'leer', exercise_ids: [] },
  ]

  it('nimmt ohne Historie den ersten Plan mit Übungen', () => {
    expect(suggestNextPlan(plans, [])?.id).toBe('push')
  })

  it('wählt den am längsten nicht trainierten Plan (Übungs-Überschneidung)', () => {
    const sets = [
      set({ exercise_id: 'bank', date: '2026-10-02' }),
      set({ exercise_id: 'rudern', date: '2026-09-30' }),
    ]
    expect(suggestNextPlan(plans, sets)?.id).toBe('pull')
  })

  it('nie trainierte Pläne zuerst', () => {
    const sets = [set({ exercise_id: 'bank', date: '2026-10-02' })]
    expect(suggestNextPlan(plans, sets)?.id).toBe('pull')
  })

  it('berücksichtigt die gemerkte Plan-Zuordnung', () => {
    const sets = [set({ exercise_id: 'bank', date: '2026-09-20' })]
    const q = new Map([['pull', '2026-10-01']])
    expect(suggestNextPlan(plans, sets, q)?.id).toBe('push')
  })

  it('ignoriert leere Vorlagen-Sätze', () => {
    const sets = [set({ exercise_id: 'bank', date: '2026-10-02', reps: 0 })]
    expect(suggestNextPlan(plans, sets)?.id).toBe('push')
  })
})

describe('recoveryLevel', () => {
  it('stuft nach Tagen ein', () => {
    expect(recoveryLevel(0)).toBe('tired')
    expect(recoveryLevel(1)).toBe('tired')
    expect(recoveryLevel(2)).toBe('almost')
    expect(recoveryLevel(3)).toBe('fresh')
    expect(recoveryLevel(null)).toBe('fresh')
  })
})

describe('lastSessionStats', () => {
  it('fasst den letzten Trainingstag zusammen, inkl. Rekorden und Dauer', () => {
    const sets = [
      set({ exercise_id: 'bank', date: '2026-09-28', weight: 60 }),
      set({ exercise_id: 'bank', date: '2026-10-02', weight: 70, created_at: '2026-10-02T10:00:00Z' }),
      set({ exercise_id: 'bank', date: '2026-10-02', weight: 50, created_at: '2026-10-02T10:10:00Z' }),
      set({ exercise_id: 'curls', date: '2026-10-02', weight: 20, created_at: '2026-10-02T10:45:00Z' }),
      set({ exercise_id: 'curls', date: '2026-10-02', reps: 0, created_at: '2026-10-02T11:30:00Z' }),
    ]
    const s = lastSessionStats(sets, '2026-10-04')!
    expect(s.date).toBe('2026-10-02')
    expect(s.sets).toBe(3)
    expect(s.volume).toBe(8 * 70 + 8 * 50 + 8 * 20)
    expect(s.prs).toBe(1) // Bank: neu; Curls hatte keinen Vorwert
    expect(s.minutes).toBe(45)
    expect(s.exerciseIds).toEqual(['bank', 'curls'])
  })

  it('null ohne Training', () => {
    expect(lastSessionStats([], '2026-10-04')).toBeNull()
  })
})
