import { useMemo, useState } from 'react'
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

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Körpergewicht</h2>
        {latest && (
          <span className="text-sm text-cocoa-light">
            zuletzt <strong className="text-cocoa">{Number(latest.weight_kg)} kg</strong>
            {trend !== 0 && (
              <span className={trend < 0 ? 'text-emerald-500' : 'text-amber-500'}>
                {' '}
                ({trend > 0 ? '+' : ''}
                {trend} kg)
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <input
          className="input"
          inputMode="decimal"
          placeholder={latest ? String(Number(latest.weight_kg)) : 'kg'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button className="btn-primary shrink-0" onClick={save} disabled={upsert.isPending}>
          {weights?.some((w) => w.date === today) ? 'Aktualisieren' : 'Eintragen'}
        </button>
      </div>

      {chartData.length >= 2 && (
        <ResponsiveContainer width="100%" height={90}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
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
            <Line type="monotone" dataKey="kg" stroke="#E11D48" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
