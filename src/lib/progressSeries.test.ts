import { describe, expect, it } from 'vitest'
import { dailySeries, lastWeeks, trendPct, weeklySum } from './progressSeries'

describe('Verlaufsreihen', () => {
  it('Wochen und Wochensummen', () => {
    const weeks = lastWeeks('2026-10-28', 3)
    expect(weeks).toHaveLength(3)
    const sums = weeklySum(
      [
        { date: '2026-10-27', value: 100 },
        { date: '2026-10-28', value: 50 },
        { date: '2026-10-14', value: 30 },
      ],
      weeks,
    )
    expect(sums).toEqual([30, 0, 150])
  })

  it('Tageswerte mit Lücken', () => {
    expect(dailySeries([{ date: '2026-10-27', value: 7 }], '2026-10-28', 3)).toEqual([null, 7, null])
  })

  it('Trend gegenüber dem Schnitt', () => {
    expect(trendPct([100, 100, 120])).toBe(20)
    expect(trendPct([null, 5])).toBeNull()
  })
})
