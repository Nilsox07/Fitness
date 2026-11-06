// Leichte SVG-Diagramme für die Uhr-Auswertungen – im Stil der App: Rubin als
// Linienfarbe (in Abstufungen statt bunt), gedämpfte Achsen, hell und dunkel.

import { useId, useState, type PointerEvent, type ReactNode } from 'react'
import { STAGE, ZONES, type FactorStatus, type Normal, type ScaleRange } from '../../lib/health'

const W = 340

/**
 * Linien-Diagramm einer Zeitreihe [[x, y], …] mit Achsenbeschriftung (Einheit an der y-Achse,
 * Anfang/Mitte/Ende an der x-Achse). Antippen oder Darüberfahren zeigt den Wert an der Stelle.
 */
export function SeriesChart({
  data,
  height = 120,
  color = 'rgb(var(--c-ruby))',
  colorFor,
  xLabel = (x) => String(x),
  yLabel = (y) => String(Math.round(y)),
  tipX,
  unit,
  label,
  invert = false,
  band,
  fill = true,
  dark = false,
}: {
  data: readonly [number, number][]
  height?: number
  color?: string
  /** Farbe je Wert (z. B. Pulszone) – sonst einfarbig */
  colorFor?: (y: number) => string
  xLabel?: (x: number) => string
  yLabel?: (y: number) => string
  /** x-Wert im Tooltip (Standard: wie die Achse) */
  tipX?: (x: number) => string
  /** Einheit der y-Werte, z. B. „bpm“ – steht an der Achse und im Tooltip */
  unit?: string
  /** Name für Screenreader */
  label?: string
  /** true: kleine Werte oben (z. B. Tempo min/km) */
  invert?: boolean
  /** hinterlegter Normalbereich */
  band?: { lo: number; hi: number } | null
  fill?: boolean
  /** in der dunklen Hero-Karte */
  dark?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
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
  const L = unit ? 28 + unit.length * 5.5 : 30
  const B = 18
  const px = (x: number) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - 4)
  const py = (y: number) => {
    const t = (y - lo) / (hi - lo || 1)
    return 4 + (invert ? t : 1 - t) * (height - B - 8)
  }
  const pts = data.map(([x, y]) => `${px(x).toFixed(1)},${py(y).toFixed(1)}`)
  const yTop = invert ? lo + pad : hi - pad
  const yBot = invert ? hi - pad : lo + pad
  const axis = dark ? 'fill-white/55 dark:fill-cocoa-muted' : 'fill-cocoa-muted'
  const xm = data[Math.floor(data.length / 2)][0]
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const sx = ((e.clientX - r.left) / (r.width || 1)) * W
    let best = 0
    for (let k = 1; k < data.length; k++) if (Math.abs(px(data[k][0]) - sx) < Math.abs(px(data[best][0]) - sx)) best = k
    setHover(best)
  }
  const h = hover != null ? data[hover] : null
  const hx = h ? px(h[0]) : 0
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-pan-y"
        role="img"
        aria-label={label ?? (unit ? `Verlauf in ${unit}` : 'Verlauf')}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" style={{ stopColor: color, stopOpacity: 0.3 }} />
            <stop offset="1" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {band && (
          <rect
            x={L}
            width={W - L - 4}
            y={Math.min(py(band.lo), py(band.hi))}
            height={Math.abs(py(band.lo) - py(band.hi))}
            className={dark ? 'fill-white/10' : 'fill-sand-dark/40'}
          />
        )}
        {[yTop, yBot].map((v, i) => (
          <g key={i}>
            <line
              x1={L}
              x2={W - 4}
              y1={py(v)}
              y2={py(v)}
              className={dark ? 'stroke-white/15' : 'stroke-sand-dark/60'}
              strokeDasharray="3 4"
            />
            <text x={L - 4} y={py(v) + 3} textAnchor="end" className={`${axis} text-[9px]`}>
              {yLabel(v)}
              {unit ? ` ${unit}` : ''}
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
                style={{ stroke: colorFor((y + data[i][1]) / 2) }}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            ))
        ) : (
          <polyline
            points={pts.join(' ')}
            fill="none"
            style={{ stroke: color }}
            strokeWidth={2.4}
            strokeLinejoin="round"
          />
        )}
        <text x={L} y={height - 4} className={`${axis} text-[9px]`}>
          {xLabel(x0)}
        </text>
        {data.length > 4 && (
          <text x={px(xm)} y={height - 4} textAnchor="middle" className={`${axis} text-[9px]`}>
            {xLabel(xm)}
          </text>
        )}
        <text x={W - 4} y={height - 4} textAnchor="end" className={`${axis} text-[9px]`}>
          {xLabel(x1)}
        </text>
        {h && (
          <g pointerEvents="none">
            <line
              x1={hx}
              x2={hx}
              y1={4}
              y2={height - B}
              className={dark ? 'stroke-white/40 dark:stroke-cocoa-muted' : 'stroke-cocoa-muted'}
              strokeWidth={1}
            />
            <circle
              cx={hx}
              cy={py(h[1])}
              r={4}
              style={{ fill: colorFor ? colorFor(h[1]) : color }}
              className={dark ? 'stroke-cocoa dark:stroke-sand-light' : 'stroke-cream'}
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {h && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-cocoa px-2 py-1 text-[11px] font-semibold text-bg shadow-md dark:bg-sand-dark dark:text-cocoa"
          style={{ left: `${Math.min(85, Math.max(15, (hx / W) * 100))}%` }}
        >
          <span className="tabular">
            {yLabel(h[1])}
            {unit ? ` ${unit}` : ''}
          </span>
          <span className="ml-1.5 font-normal opacity-70">{(tipX ?? xLabel)(h[0])}</span>
        </div>
      )}
    </div>
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
            style={{ fill: STAGE[c as keyof typeof STAGE]?.color ?? 'rgb(var(--c-ruby) / 0.45)' }}
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
  gut: 'bg-good/15 text-good',
  normal: 'bg-sand text-cocoa-light',
  schwach: 'bg-gold/20 text-cocoa',
}
const STATUS_TEXT: Record<FactorStatus, string> = { gut: 'Gut', normal: 'Normal', schwach: 'Achtung' }

export function StatusChip({ status }: { status: FactorStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_CLS[status]}`}>
      {STATUS_TEXT[status]}
    </span>
  )
}

/**
 * Abschnitt wie im Rest der App: Überschrift in Versalien über der Karte,
 * darin optional ein großer Wert und der Inhalt. (Das Symbol entfällt bewusst – ruhiger.)
 */
export function MetricCard({
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
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{title}</h2>
        {right}
      </div>
      <div className="card space-y-3">
        {value != null && (
          <div className="flex items-baseline gap-2">
            <span className="tabular text-2xl font-bold">{value}</span>
            {sub && <span className="text-sm text-cocoa-light">{sub}</span>}
          </div>
        )}
        {children}
      </div>
    </section>
  )
}

/** Trend über Tage mit persönlichem Normalbereich. */
export function TrendChart({
  points,
  normal,
  color = 'rgb(var(--c-ruby))',
  unit,
  decimals = 0,
}: {
  points: readonly [string, number][]
  normal?: Normal | null
  color?: string
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
        yLabel={(y) => y.toLocaleString('de-DE', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}
        unit={unit || undefined}
        band={normal ? { lo: normal.lo, hi: normal.hi } : null}
      />
      {normal && (
        <p className="flex items-center gap-1.5 text-[11px] text-cocoa-muted">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-sand-dark/60" aria-hidden />
          Dein Normalbereich {de(normal.lo, decimals)}–{de(normal.hi, decimals)} {unit}
        </p>
      )}
    </>
  )
}

const de = (v: number, d = 0) => v.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d })

/**
 * Wert auf einer Skala: Spur min–max, hinterlegter Normal-/Zielbereich, Punkt für den Wert.
 * `dark` für die dunkle Hero-Karte.
 */
export function RangeBar({
  range,
  status,
  dark = false,
  className = '',
}: {
  range: ScaleRange
  status?: FactorStatus
  dark?: boolean
  className?: string
}) {
  const span = range.max - range.min || 1
  const pos = (v: number) => Math.min(100, Math.max(0, ((v - range.min) / span) * 100))
  const lo = pos(range.lo)
  const hi = pos(range.hi)
  const at = pos(range.value)
  const dot = status === 'gut' ? 'bg-good' : status === 'schwach' ? 'bg-gold' : 'bg-brand'
  return (
    <span className={`relative block h-3 ${className}`} aria-hidden>
      <span
        className={`absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full ${dark ? 'bg-white/10' : 'bg-sand dark:bg-sand-dark/60'}`}
      />
      <span
        className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${dark ? 'bg-white/25' : 'bg-sand-dark dark:bg-cocoa-muted/50'}`}
        style={{ left: `${lo}%`, width: `${Math.max(2, hi - lo)}%` }}
      />
      <span
        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ${dot} ${
          dark ? 'ring-cocoa dark:ring-sand-light' : 'ring-cream'
        }`}
        style={{ left: `${at}%` }}
      />
    </span>
  )
}

/**
 * Beitrag zur Tagesform als Balken von der Mitte aus: nach rechts (grün) hebt, nach links (gold) senkt.
 * `scale` = größter Betrag, auf den alle Balken einer Liste bezogen werden.
 */
export function ImpactBar({ effect, scale }: { effect: number; scale: number }) {
  const w = Math.min(50, (Math.abs(effect) / (scale || 1)) * 50)
  return (
    <span className="relative block h-4 w-full" aria-hidden>
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sand-dark" />
      {effect === 0 ? (
        <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cocoa-muted" />
      ) : (
        <span
          className={`absolute top-1/2 h-2.5 -translate-y-1/2 ${
            effect > 0 ? 'left-1/2 rounded-r-full bg-good' : 'right-1/2 rounded-l-full bg-gold'
          }`}
          style={{ width: `${Math.max(4, w)}%` }}
        />
      )}
    </span>
  )
}

/** Belastungs-Skala leicht → sehr hoch mit Markierung (Stufen wie loadLabel). */
export function LoadGauge({ load }: { load: number }) {
  const MAX = 220
  const steps = [
    { to: 40, label: 'leicht' },
    { to: 90, label: 'mittel' },
    { to: 160, label: 'hoch' },
    { to: MAX, label: 'sehr hoch' },
  ]
  const at = Math.min(100, (load / MAX) * 100)
  let from = 0
  return (
    <div aria-hidden>
      <div className="relative">
        <div className="flex h-2.5 gap-0.5">
          {steps.map((s, i) => {
            const w = ((s.to - from) / MAX) * 100
            from = s.to
            return (
              <span
                key={s.label}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${w}%`, background: `rgb(var(--c-ruby) / ${0.2 + i * 0.25})` }}
              />
            )
          })}
        </div>
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cocoa ring-2 ring-cream"
          style={{ left: `${at}%` }}
        />
      </div>
      <div className="mt-1 flex text-[10px] text-cocoa-muted">
        {(() => {
          let f = 0
          return steps.map((s) => {
            const w = ((s.to - f) / MAX) * 100
            f = s.to
            return (
              <span key={s.label} className="truncate text-center" style={{ width: `${w}%` }}>
                {s.label}
              </span>
            )
          })
        })()}
      </div>
    </div>
  )
}
