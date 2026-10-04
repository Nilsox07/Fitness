import type { CSSProperties } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { nf, useChartTheme } from '../stats/shared'
import { SectionTitle } from './ui'

export type KcalDay = { date: string; label: string; kcal: number; target: number | null; today: boolean }

/** Kalorien je Tag mit Ziel-Stufenlinie; heute heller (noch unvollständig). */
export function KcalChartCard({
  data,
  showTarget,
  style,
}: {
  data: KcalDay[]
  showTarget: boolean
  style?: CSSProperties
}) {
  const chart = useChartTheme()
  const tooltip = {
    ...chart.tooltip,
    contentStyle: {
      ...chart.tooltip.contentStyle,
      borderRadius: 12,
      boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
      padding: '6px 10px',
    },
  }
  return (
    <section style={style}>
      <SectionTitle right={`${data.length} Tage`}>Kalorien pro Tag</SectionTitle>
      <div className="card px-2 pb-2 pt-3">
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chart.grid} strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="label" tick={chart.axisStyle} tickLine={false} axisLine={false} minTickGap={10} />
            <YAxis
              tick={chart.axisStyle}
              width={38}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v: number) => nf(v)}
            />
            <Tooltip {...tooltip} formatter={(v: number, name: string) => [`${nf(v)} kcal`, name]} />
            <Bar dataKey="kcal" name="Kalorien" radius={[6, 6, 2, 2]} maxBarSize={18}>
              {data.map((d) => (
                <Cell key={d.date} fill={chart.primary} fillOpacity={d.today ? 0.35 : 0.9} />
              ))}
            </Bar>
            {/* Ziel je Tag (Trainingstage mit Bonus) als Stufenlinie */}
            {showTarget && (
              <Line
                type="step"
                dataKey="target"
                name="Ziel"
                stroke={chart.muted}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        {showTarget && (
          <div className="flex items-center justify-center gap-3 pb-1 text-[10px] text-cocoa-muted">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-brand" />
              Gegessen
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 border-t-[1.5px] border-dashed border-cocoa-muted" />
              Ziel
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
