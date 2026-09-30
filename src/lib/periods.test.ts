import { describe, expect, it } from 'vitest'
import { inRange, pctChange, periodBuckets, periodRange, sumByBucket } from './periods'

describe('periodRange', () => {
  it('week: Monday until today vs. same span last week', () => {
    // 2026-09-30 ist ein Mittwoch
    expect(periodRange('week', '2026-09-30')).toEqual({
      start: '2026-09-28',
      end: '2026-09-30',
      periodEnd: '2026-10-04',
      prevStart: '2026-09-21',
      prevEnd: '2026-09-23',
    })
  })

  it('week starting on Sunday belongs to the previous Monday', () => {
    expect(periodRange('week', '2026-10-04').start).toBe('2026-09-28')
  })

  it('month: clamps the previous span to the shorter month', () => {
    expect(periodRange('month', '2026-03-31')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
      periodEnd: '2026-03-31',
      prevStart: '2026-02-01',
      prevEnd: '2026-02-28',
    })
    expect(periodRange('month', '2026-01-15').prevStart).toBe('2025-12-01')
    expect(periodRange('month', '2026-01-15').prevEnd).toBe('2025-12-15')
  })

  it('year: Jan 1st until today vs. same span last year', () => {
    expect(periodRange('year', '2026-09-30')).toEqual({
      start: '2026-01-01',
      end: '2026-09-30',
      periodEnd: '2026-12-31',
      prevStart: '2025-01-01',
      prevEnd: '2025-09-30',
    })
  })
})

describe('helpers', () => {
  it('inRange is inclusive', () => {
    expect(inRange('2026-09-01', '2026-09-01', '2026-09-30')).toBe(true)
    expect(inRange('2026-10-01', '2026-09-01', '2026-09-30')).toBe(false)
  })

  it('pctChange', () => {
    expect(pctChange(108, 100)).toBe(8)
    expect(pctChange(50, 100)).toBe(-50)
    expect(pctChange(5, 0)).toBeNull()
  })
})

describe('periodBuckets', () => {
  it('week → 7 days Mo–So', () => {
    const b = periodBuckets('week', '2026-09-30')
    expect(b.map((x) => x.label)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    expect(b[0].start).toBe('2026-09-28')
    expect(b[6].end).toBe('2026-10-04')
  })

  it('month → calendar weeks clipped to the month', () => {
    const b = periodBuckets('month', '2026-09-15')
    // September 2026 beginnt an einem Dienstag
    expect(b[0]).toEqual({ label: '01.09', start: '2026-09-01', end: '2026-09-06' })
    expect(b[1].start).toBe('2026-09-07')
    expect(b[b.length - 1].end).toBe('2026-09-30')
    expect(b).toHaveLength(5)
  })

  it('year → 12 months', () => {
    const b = periodBuckets('year', '2026-09-30')
    expect(b).toHaveLength(12)
    expect(b[1]).toEqual({ label: 'Feb', start: '2026-02-01', end: '2026-02-28' })
  })

  it('sumByBucket', () => {
    const b = periodBuckets('week', '2026-09-30')
    const s = sumByBucket(
      [
        { date: '2026-09-28', value: 100 },
        { date: '2026-09-28', value: 50 },
        { date: '2026-09-30', value: 20 },
        { date: '2026-09-20', value: 999 },
      ],
      b,
    )
    expect(s[0].value).toBe(150)
    expect(s[2].value).toBe(20)
    expect(s.reduce((a, x) => a + x.value, 0)).toBe(170)
  })
})
