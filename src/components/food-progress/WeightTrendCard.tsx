import { useId, useMemo, type CSSProperties } from 'react'
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { useBodyWeights } from '../../hooks/useBodyWeight'
import { useNutritionSettings } from '../../hooks/useNutrition'
import { shiftDate } from '../../lib/day'
import { accentColor } from '../../lib/cosmetics'
import { weightChangeFitsGoal } from '../../lib/foodProgress'
import { trendChange, weightTrend } from '../../lib/weightTrend'
import { nf, signed, useChartTheme } from '../stats/shared'
import { SectionTitle } from './ui'

const ddmm = (date: string) => `${date.slice(8, 10)}.${date.slice(5, 7)}`

/** Körpergewicht: geglätteter Trend (EMA) mit Verlaufsfläche, Kopf im Health-Stil. */
export function WeightTrendCard({ style }: { style?: CSSProperties }) {
  const chart = useChartTheme()
  const gradId = useId().replace(/:/g, '')
  const { data: weights } = useBodyWeights()
  const { data: settings } = useNutritionSettings()

  const w = useMemo(() => {
    const trend = weightTrend((weights ?? []).map((x) => ({ date: x.date, kg: Number(x.weight_kg) })))
    const last = trend[trend.length - 1]
    // Anzeige: die letzten 90 Tage (der Trend nutzt die ganze Historie)
    const from = last ? shiftDate(last.date, -90) : ''
    return {
      last,
      c7: trendChange(trend, 7),
      c30: trendChange(trend, 30),
      data: trend.filter((p) => p.date >= from).map((p) => ({ ...p, label: ddmm(p.date) })),
    }
  }, [weights])

  if (!w.last) return null

  // Hauptkennzahl: 30-Tage-Änderung, sonst 7 Tage
  const change = w.c30 ?? w.c7
  const span = w.c30 !== null ? 30 : 7
  const fits = change !== null && weightChangeFitsGoal(change, settings?.goal)
  const Icon = change === null || change === 0 ? Minus : change < 0 ? TrendingDown : TrendingUp
  const tooltip = {
    ...chart.tooltip,
    contentStyle: { ...chart.tooltip.contentStyle, borderRadius: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.12)' },
  }

  return (
    <section style={style}>
      <SectionTitle>Körpergewicht</SectionTitle>
      <div className="card space-y-2">
        <div>
          <div className="text-xs font-medium text-cocoa-light">Trend</div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="tabular text-3xl font-bold tracking-tight text-cocoa">
              {nf(w.last.trend, 1)}
              <span className="ml-0.5 text-sm font-semibold text-cocoa-light">kg</span>
            </span>
            {change !== null ? (
              <span
                className={`tabular flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  fits ? 'bg-success/15 text-success' : 'bg-gold/15 text-gold'
                }`}
              >
                <Icon size={13} />
                {signed(change)} kg in {span} T.
              </span>
            ) : (
              <span className="text-xs text-cocoa-muted">Noch zu wenige Messungen für einen Trend</span>
            )}
          </div>
          {w.c7 !== null && w.c30 !== null && (
            <div className="tabular mt-0.5 text-xs text-cocoa-muted">{signed(w.c7)} kg in 7 Tagen</div>
          )}
        </div>

        {w.data.length >= 2 && (
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={w.data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor('base', 0.28)} />
                  <stop offset="100%" stopColor={accentColor('base', 0.02)} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chart.grid} strokeOpacity={0.6} vertical={false} />
              <XAxis dataKey="label" tick={chart.axisStyle} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tick={chart.axisStyle}
                width={36}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => nf(v, 1)}
              />
              <Tooltip
                {...tooltip}
                cursor={{ stroke: chart.grid }}
                formatter={(v: number, name: string) => [`${nf(v, 1)} kg`, name]}
              />
              <Area
                type="monotone"
                dataKey="trend"
                name="Trend"
                stroke={chart.primary}
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                baseValue="dataMin"
                dot={false}
                activeDot={{ r: 4, fill: chart.primary, stroke: chart.tipBg, strokeWidth: 2 }}
                isAnimationActive={false}
              />
              <Line
                dataKey="kg"
                name="Gewogen"
                stroke="transparent"
                dot={{ r: 2.25, fill: chart.muted, fillOpacity: 0.7, stroke: 'none' }}
                activeDot={{ r: 3.5, fill: chart.muted, stroke: 'none' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        <p className="text-[11px] text-cocoa-muted">
          Punkte = gewogene Werte, Linie = geglätteter Trend. Gewicht trägst du im Ernährungs-Tag „Heute“ ein.
        </p>
      </div>
    </section>
  )
}
