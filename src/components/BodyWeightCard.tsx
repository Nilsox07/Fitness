import { useMemo, useState } from 'react'
import { Minus, Scale, TrendingDown, TrendingUp } from 'lucide-react'
import { accentColor } from '../lib/cosmetics'
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { useBodyWeights, useUpsertBodyWeight } from '../hooks/useBodyWeight'
import { useTheme } from '../lib/theme'

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

export function BodyWeightCard() {
  const { data: weights } = useBodyWeights()
  const upsert = useUpsertBodyWeight()
  const dark = useTheme().resolved === 'dark'
  const today = todayLocal()

  const latest = weights && weights.length ? weights[weights.length - 1] : null
  const [value, setValue] = useState('')

  const chartData = useMemo(
    () => (weights ?? []).slice(-30).map((w) => ({ date: w.date, kg: Number(w.weight_kg) })),
    [weights],
  )

  const trend =
    chartData.length >= 2
      ? Math.round((chartData[chartData.length - 1].kg - chartData[0].kg) * 10) / 10
      : 0

  function save() {
    const kg = parseFloat(value.replace(',', '.'))
    if (!Number.isFinite(kg) || kg <= 0) return
    upsert.mutate({ date: today, weight_kg: kg })
    setValue('')
  }

  const loggedToday = weights?.some((w) => w.date === today) ?? false
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const fmtKg = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })

  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
            <Scale size={13} />
            Körpergewicht
          </h2>
          {latest ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tabular text-3xl font-bold tracking-tight text-cocoa">
                {fmtKg(Number(latest.weight_kg))}
              </span>
              <span className="text-sm text-cocoa-light">kg</span>
              {chartData.length >= 2 && (
                <span
                  className="tabular inline-flex items-center gap-0.5 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-cocoa-light"
                  title="Veränderung über die letzten Messungen"
                >
                  <TrendIcon size={13} strokeWidth={2.5} />
                  {trend > 0 ? '+' : trend < 0 ? '−' : '±'}
                  {fmtKg(Math.abs(trend))}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-cocoa-light">Trag dein Gewicht ein, um den Verlauf zu sehen.</p>
          )}
        </div>

        {chartData.length >= 2 && (
          <div className="h-12 w-24 shrink-0" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
                <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
                <Tooltip
                  contentStyle={{
                    background: dark ? '#161D2B' : '#FFFFFF',
                    border: `1px solid ${dark ? '#344155' : '#D2D6DD'}`,
                    color: dark ? '#E5E9F0' : '#0B0F19',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: dark ? '#E5E9F0' : '#0B0F19' }}
                />
                <Line type="monotone" dataKey="kg" stroke={accentColor()} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            className="input tabular rounded-2xl pr-10 text-base"
            inputMode="decimal"
            aria-label="Gewicht in kg"
            placeholder={latest ? fmtKg(Number(latest.weight_kg)) : 'Gewicht'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-cocoa-muted">
            kg
          </span>
        </div>
        <button className="btn-primary shrink-0 rounded-2xl" onClick={save} disabled={upsert.isPending || !value.trim()}>
          {loggedToday ? 'Aktualisieren' : 'Eintragen'}
        </button>
      </div>
    </section>
  )
}
