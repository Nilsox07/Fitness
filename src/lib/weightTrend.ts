// Geglätteter Körpergewichts-Trend (exponentiell gleitender Mittelwert, à la
// „Hacker's Diet" / MacroFactor). Rein und testbar.

export interface WeightPoint {
  /** YYYY-MM-DD */
  date: string
  kg: number
}

export interface TrendPoint extends WeightPoint {
  trend: number
}

/** Standard-Glättung pro Tag (≈ 10 %). */
export const DEFAULT_ALPHA = 0.1

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86400000)
}

/**
 * Exponentiell gleitender Mittelwert über die (nach Datum sortierten) Messungen.
 * Lücken zwischen Messungen werden berücksichtigt: nach n Tagen Pause wirkt die
 * neue Messung so stark, als wäre an jedem Tag dazwischen gewogen worden
 * (alpha_eff = 1 − (1 − alpha)^n).
 */
export function weightTrend(points: WeightPoint[], alpha = DEFAULT_ALPHA): TrendPoint[] {
  const sorted = points
    .filter((p) => Number.isFinite(p.kg) && p.kg > 0)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const out: TrendPoint[] = []
  let trend = 0
  let lastDay = 0
  for (const p of sorted) {
    const day = dayNumber(p.date)
    if (out.length === 0) {
      trend = p.kg
    } else {
      const gap = Math.max(1, day - lastDay)
      const a = 1 - Math.pow(1 - alpha, gap)
      trend = trend + a * (p.kg - trend)
    }
    lastDay = day
    out.push({ date: p.date, kg: p.kg, trend: Math.round(trend * 100) / 100 })
  }
  return out
}

/**
 * Veränderung des Trendgewichts über die letzten `days` Tage (bezogen auf die
 * letzte Messung). Vergleichswert ist der Trend am letzten Messtag, der
 * mindestens `days` Tage zurückliegt. null, wenn es keinen solchen gibt.
 */
export function trendChange(trend: TrendPoint[], days: number): number | null {
  if (trend.length < 2) return null
  const last = trend[trend.length - 1]
  const cutoff = dayNumber(last.date) - days
  let ref: TrendPoint | null = null
  for (const p of trend) {
    if (dayNumber(p.date) <= cutoff) ref = p
    else break
  }
  if (!ref) return null
  return Math.round((last.trend - ref.trend) * 10) / 10
}
