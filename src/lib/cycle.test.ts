import { describe, expect, it } from 'vitest'
import { cycleState, cycleStats, periodDays, readinessEffect, waterRetentionLikely, type Period } from './cycle'

const periods: Period[] = [
  { start_date: '2026-08-01', end_date: '2026-08-05' },
  { start_date: '2026-08-30', end_date: '2026-09-03' },
  { start_date: '2026-09-28', end_date: '2026-10-02' },
]

describe('Zyklus', () => {
  it('Durchschnitt aus den Abständen', () => {
    expect(cycleStats(periods)).toEqual({ length: 29, periodLength: 5, count: 3 })
    expect(cycleStats([{ start_date: '2026-10-01', end_date: null }]).length).toBe(28)
  })

  it('Periode, Follikel- und Lutealphase', () => {
    const p = cycleState(periods, '2026-09-29')!
    expect(p.phase).toBe('menstruation')
    expect(p.day).toBe(2)
    expect(cycleState(periods, '2026-10-05')!.phase).toBe('follicular')
    const late = cycleState(periods, '2026-10-24')!
    expect(late.phase).toBe('luteal')
    expect(late.latePms).toBe(true)
    expect(late.nextPeriod).toBe('2026-10-27')
    expect(waterRetentionLikely(late)).toBe(true)
  })

  it('ohne Daten nichts, mit einer Periode grobe Schätzung', () => {
    expect(cycleState([], '2026-10-01')).toBeNull()
    expect(cycleState([{ start_date: '2026-10-01', end_date: null }], '2026-10-03')!.rough).toBe(true)
  })

  it('Einfluss auf die Tagesform', () => {
    expect(readinessEffect(cycleState(periods, '2026-09-28')!)).toBe(-5)
    expect(readinessEffect(cycleState(periods, '2026-10-06')!)).toBe(2)
  })

  it('Periodentage für den Kalender', () => {
    const d = periodDays([{ start_date: '2026-10-01', end_date: '2026-10-03' }])
    expect([...d]).toEqual(['2026-10-01', '2026-10-02', '2026-10-03'])
  })
})
