import { describe, expect, it } from 'vitest'
import { trendChange, weightTrend } from './weightTrend'

describe('weightTrend', () => {
  it('returns empty for no data and starts at the first weight', () => {
    expect(weightTrend([])).toEqual([])
    const t = weightTrend([{ date: '2026-09-01', kg: 80 }])
    expect(t).toEqual([{ date: '2026-09-01', kg: 80, trend: 80 }])
  })

  it('smooths daily noise with an EMA', () => {
    const t = weightTrend(
      [
        { date: '2026-09-01', kg: 80 },
        { date: '2026-09-02', kg: 82 },
      ],
      0.1,
    )
    expect(t[1].trend).toBeCloseTo(80.2, 5)
  })

  it('sorts input and ignores invalid weights', () => {
    const t = weightTrend([
      { date: '2026-09-03', kg: 81 },
      { date: '2026-09-01', kg: 80 },
      { date: '2026-09-02', kg: 0 },
    ])
    expect(t.map((p) => p.date)).toEqual(['2026-09-01', '2026-09-03'])
  })

  it('weights a measurement after a gap more strongly', () => {
    const daily = weightTrend(
      [
        { date: '2026-09-01', kg: 80 },
        { date: '2026-09-02', kg: 82 },
      ],
      0.1,
    )
    const gap = weightTrend(
      [
        { date: '2026-09-01', kg: 80 },
        { date: '2026-09-11', kg: 82 },
      ],
      0.1,
    )
    // 1 − 0,9^10 ≈ 0,651
    expect(gap[1].trend).toBeCloseTo(80 + 2 * (1 - Math.pow(0.9, 10)), 2)
    expect(gap[1].trend).toBeGreaterThan(daily[1].trend)
  })

  it('converges towards a stable new weight', () => {
    const pts = Array.from({ length: 60 }, (_, i) => ({
      date: `2026-${i < 30 ? '08' : '09'}-${String((i % 30) + 1).padStart(2, '0')}`,
      kg: 75,
    }))
    const t = weightTrend([{ date: '2026-07-31', kg: 80 }, ...pts])
    expect(t[t.length - 1].trend).toBeCloseTo(75, 0)
  })
})

describe('trendChange', () => {
  const t = weightTrend(
    Array.from({ length: 31 }, (_, i) => ({
      date: `2026-08-${String(i + 1).padStart(2, '0')}`,
      kg: 80 - i * 0.1,
    })),
  )

  it('compares against the trend at least N days back', () => {
    const c7 = trendChange(t, 7)
    expect(c7).not.toBeNull()
    expect(c7!).toBeLessThan(0)
    const c30 = trendChange(t, 30)
    expect(c30!).toBeLessThan(c7!)
  })

  it('returns null when history is too short', () => {
    expect(trendChange(t, 60)).toBeNull()
    expect(trendChange(t.slice(0, 1), 7)).toBeNull()
  })
})
