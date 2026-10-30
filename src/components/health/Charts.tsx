// Leichte SVG-Diagramme für die Uhr-Auswertungen (keine Chart-Bibliothek nötig,
// funktionieren hell und dunkel über currentColor bzw. feste Zonenfarben).

import { useId, type ReactNode } from 'react'
import { STAGE, ZONES, type FactorStatus, type Normal } from '../../lib/health'

const W = 340

/** Linien-Diagramm einer Zeitreihe [[x, y], …] mit Achsenbeschriftung. */
export function SeriesChart({
  data,
  height = 120,
  color = '#ef4444',
  colorFor,
  xLabel = (x) => String(x),
  yLabel = (y) => String(Math.round(y)),
  invert = false,
  band,
  fill = true,
}: {
  data: readonly [number, number][]
  height?: number
  color?: string
  /** Farbe je Wert (z. B. Pulszone) – sonst einfarbig */
  colorFor?: (y: number) => string
  xLabel?: (x: number) => string
  yLabel?: (y: number) => string
  /** true: kleine Werte oben (z. B. Tempo min/km) */
  invert?: boolean
  /** hinterlegter Normalbereich */
  band?: { lo: number; hi: number } | null
  fill?: boolean
}) {
  const id = useId().replace(/:/g, '')
  if (data.length < 2) return null
  const xs = data.map((d) => d[0])
  const ys = data.map((d) => d[1])
  let lo = Math.min(...ys, band?.lo ?? Infinity)
  let hi = Math.max(...ys, band?.hi ?? -Infinity)
  const pad = (hi - lo) * 0.12 || 1
  lo -= pad
  hi += pad
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const L = 30
  const B = 18
  const px = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - 4)
  const py = (y: number) => {
    const t = (y - lo) / (hi - lo || 1)
    return 4 + (invert ? t : 1 - t) * (height - B - 8)
  }
  const pts = data.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`)
  const yTop = invert ? lo + pad : hi - pad
  const yBot = invert ? hi - pad : lo + pad
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img">
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {band && (
        <rect
          x={L}
          width={W - L - 4}
          y={Math.min(py(band.lo), py(band.hi))}
          height={Math.abs(py(band.lo) - py(band.hi))}
          className="fill-success/10"
        />
      )}
      {[yTop, yBot].map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - 4} y1={py(v)} y2={py(v)} className="stroke-sand-dark/60" strokeDasharray="3 4" />
          <text x={L - 4} y={py(v) + 3} textAnchor="end" className="fill-cocoa-muted text-[9px]">
            {yLabel(v)}
          </text>
        </g>
      ))}
      {fill && !colorFor && (
        <polygon points={`${px(x0)},${height - B} ${pts.join(' ')} ${px(x1)},${height - B}`} fill={`url(#g${id})`} />
      )}
      {colorFor ? (
        data
          .slice(1)
          .map(([x, y], i) => (
            <line
              key={i}
              x1={px(data[i][0])}
              y1={py(data[i][1])}
              x2={px(x)}
              y2={py(y)}
              stroke={colorFor((y + data[i][1]) / 2)}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          ))
      ) : (
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" />
      )}
      <text x={L} y={height - 4} className="fill-cocoa-muted text-[9px]">
        {xLabel(x0)}
      </text>
      <text x={W - 4} y={height - 4} textAnchor="end" className="fill-cocoa-muted text-[9px]">
        {xLabel(x1)}
      </text>
    </svg>
  )
}

/** Zeit in den fünf Pulszonen als Balken mit Minuten und Anteil. */
export function ZoneBars({ times }: { times: number[] }) {
  const total = times.reduce((a, b) => a + b, 0) || 1
  return (
    <div className="space-y-1.5">
      {[...ZONES].reverse().map((z) => {
        const s = times[z.zone - 1]
        const pct = Math.round((s / total) * 100)
        return (
          <div key={z.zone} className="flex items-center gap-2 text-xs">
            <span className="w-[5.5rem] shrink-0 leading-tight">
              <span className="block font-semibold">Zone {z.zone}</span>
              <span className="block text-[10px] text-cocoa-muted">{z.label}</span>
            </span>
            <span className="h-3 flex-1 overflow-hidden rounded-full bg-sand-dark/40">
              <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: z.color }} />
            </span>
            <span className="tabular w-20 shrink-0 whitespace-nowrap text-right text-cocoa-light">
              {Math.round(s / 60)} min · {pct} %
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Schlafphasen-Verlauf: Wach oben, Tiefschlaf unten. */
export function Hypnogram({ stages, start }: { stages: readonly [number, number, number][]; start: string }) {
  const rows: Record<number, number> = { 1: 0, 4: 1, 2: 2, 5: 2, 3: 3 }
  const total = Math.max(...stages.map(([s, d]) => s + d), 1)
  const H = 120
  const rowH = (H - 22) / 4
  const begin = new Date(start)
  const ticks: { x: number; label: string }[] = []
  const first = new Date(begin)
  first.setMinutes(0, 0, 0)
  first.setHours(first.getHours() + 1)
  for (let t = first.getTime(); t < begin.getTime() + total * 60000; t += 2 * 3600000) {
    const min = (t - begin.getTime()) / 60000
    ticks.push({ x: 44 + (min / total) * (W - 48), label: `${new Date(t).getHours()}` })
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Schlafphasen">
      {['Wach', 'REM', 'Leicht', 'Tief'].map((l, i) => (
        <text key={l} x={0} y={i * rowH + rowH / 2 + 3} className="fill-cocoa-muted text-[9px]">
          {l}
        </text>
      ))}
      {stages.map(([s, d, c], i) => {
        const r = rows[c] ?? 2
        return (
          <rect
            key={i}
            x={44 + (s / total) * (W - 48)}
            width={Math.max(1, (d / total) * (W - 48))}
            y={r * rowH + 2}
            height={rowH - 4}
            rx={3}
            fill={STAGE[c as keyof typeof STAGE]?.color ?? '#818cf8'}
          />
        )
      })}
      {ticks.map((t) => (
        <text key={t.x} x={t.x} y={H - 4} textAnchor="middle" className="fill-cocoa-muted text-[9px]">
          {t.label} Uhr
        </text>
      ))}
    </svg>
  )
}

const STATUS_CLS: Record<FactorStatus, string> = {
  gut: 'bg-success/15 text-success',
  normal: 'bg-sand text-cocoa-light',
  schwach: 'bg-red-500/10 text-red-500',
}
const STATUS_TEXT: Record<FactorStatus, string> = { gut: 'Gut', normal: 'Normal', schwach: 'Achtung' }

export function StatusChip({ status }: { status: FactorStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLS[status]}`}>
      {STATUS_TEXT[status]}
    </span>
  )
}

/** Karte mit Titel, großem Wert und Inhalt. */
export function MetricCard({
  icon,
  title,
  value,
  sub,
  children,
  right,
}: {
  icon?: ReactNode
  title: string
  value?: ReactNode
  sub?: ReactNode
  children?: ReactNode
  right?: ReactNode
}) {
  return (
    <section className="card space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-cocoa-light">{title}</h2>
        {right}
      </div>
      {value != null && (
        <div className="flex items-baseline gap-2">
          <span className="tabular text-2xl font-black">{value}</span>
          {sub && <span className="text-sm text-cocoa-light">{sub}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

/** Trend über Tage mit persönlichem Normalbereich. */
export function TrendChart({
  points,
  normal,
  color,
  unit,
  decimals = 0,
}: {
  points: readonly [string, number][]
  normal?: Normal | null
  color: string
  unit: string
  decimals?: number
}) {
  if (points.length < 2) return <p className="text-xs text-cocoa-muted">Noch zu wenige Messungen für einen Verlauf.</p>
  const base = new Date(points[0][0] + 'T00:00:00').getTime()
  const data = points.map(([d, v]) => [(new Date(d + 'T00:00:00').getTime() - base) / 86400000, v] as [number, number])
  const fmt = (x: number) => {
    const d = new Date(base + x * 86400000)
    return `${d.getDate()}.${d.getMonth() + 1}.`
  }
  return (
    <>
      <SeriesChart
        data={data}
        color={color}
        height={110}
        xLabel={fmt}
        yLabel={(y) => `${y.toFixed(decimals)}`}
        band={normal ? { lo: normal.lo, hi: normal.hi } : null}
      />
      {normal && (
        <p className="text-[11px] text-cocoa-muted">
          Grün hinterlegt: dein Normalbereich ({normal.lo.toFixed(decimals)}–{normal.hi.toFixed(decimals)} {unit})
        </p>
      )}
    </>
  )
}
