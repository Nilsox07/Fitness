import { describe, expect, it } from 'vitest'
import { isoWeekId, lastWeekRange, weekBodyweight, weekPrCount } from './weeklyReview'
import type { SetWithDate } from '../types'

describe('isoWeekId', () => {
  it('liefert die ISO-Woche im Format YYYY-Www', () => {
    // 1. Januar 2026 ist ein Donnerstag → ISO-Woche 1.
    expect(isoWeekId(new Date(2026, 0, 1))).toBe('2026-W01')
    // 4. Januar 2026 (Sonntag) gehört noch zu Woche 1.
    expect(isoWeekId(new Date(2026, 0, 4))).toBe('2026-W01')
    // 5. Januar 2026 (Montag) → Woche 2.
    expect(isoWeekId(new Date(2026, 0, 5))).toBe('2026-W02')
  })
})

describe('lastWeekRange', () => {
  it('gibt Montag–Sonntag der Vorwoche zurück', () => {
    // Mittwoch, 17. September 2025 → Vorwoche Mo 8. – So 14.
    const r = lastWeekRange(new Date(2025, 8, 17))
    expect(r.start).toBe('2025-09-08')
    expect(r.end).toBe('2025-09-14')
  })
})

const set = (exercise_id: string, date: string, weight: number, reps: number, set_type = 'working') =>
  ({ exercise_id, date, weight, reps, set_type, reps_right: null, weight_right: null }) as unknown as SetWithDate

describe('weekPrCount', () => {
  const start = '2026-09-21'
  const end = '2026-09-27'
  it('zählt nur echte Verbesserungen gegenüber früher', () => {
    const sets = [
      set('a', '2026-09-01', 100, 5),
      set('a', '2026-09-22', 105, 5), // PR
      set('b', '2026-09-01', 50, 10),
      set('b', '2026-09-23', 50, 8), // kein PR
      set('c', '2026-09-24', 30, 10), // neue Übung → kein PR
      set('d', '2026-09-01', 40, 5),
      set('d', '2026-09-24', 80, 0), // nicht durchgeführt
      set('e', '2026-09-01', 40, 5),
      set('e', '2026-09-24', 80, 5, 'warmup'), // Aufwärmsatz
      set('a', '2026-09-29', 200, 5), // nach der Woche
    ]
    expect(weekPrCount(sets, start, end)).toBe(1)
  })
})

describe('weekBodyweight', () => {
  it('erste vs. letzte Messung der Woche', () => {
    const w = [
      { date: '2026-09-01', weight_kg: 90 },
      { date: '2026-09-26', weight_kg: 84.5 },
      { date: '2026-09-22', weight_kg: 85 },
    ]
    expect(weekBodyweight(w, '2026-09-21', '2026-09-27')).toEqual({ start: 85, current: 84.5 })
    expect(weekBodyweight(w.slice(0, 2), '2026-09-21', '2026-09-27')).toBeNull()
  })
})
