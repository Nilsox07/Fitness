import { useId } from 'react'
import { accentColor } from '../../lib/cosmetics'

type Pt = [number, number]

/** Monotone kubische Interpolation (Fritsch–Carlson) → weicher Pfad ohne Überschwinger. */
function smoothPath(pts: Pt[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M${pts[0][0]},${pts[0][1]}`
  const n = pts.length
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    m.push(dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i])
  }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${pts[i][0] + h},${pts[i][1] + h * t[i]} ${pts[i + 1][0] - h},${pts[i + 1][1] - h * t[i + 1]} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

const W = 100

/**
 * Weiche Flächen-Sparkline für die Hero-Karte. `values` = laufender Zeitraum
 * (bis heute), `ghost` = Vergleichszeitraum als gestrichelte Linie; beide auf
 * einer x-Achse mit `length` Punkten.
 */
export function AreaSpark({
  values,
  ghost = [],
  length,
  height = 64,
  className = '',
}: {
  values: number[]
  ghost?: number[]
  length: number
  height?: number
  className?: string
}) {
  const gid = useId()
  const H = height
  const pad = 4
  const max = Math.max(1, ...values, ...ghost)
  const x = (i: number) => (length <= 1 ? W : (i / (length - 1)) * W)
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2)
  const pts: Pt[] = values.map((v, i) => [x(i), y(v)])
  const ghostPts: Pt[] = ghost.slice(0, length).map((v, i) => [x(i), y(v)])
  const line = smoothPath(pts)
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : ''
  const color = accentColor()
  const last = pts[pts.length - 1]

  return (
    <div className={`relative ${className}`} style={{ height: H }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full overflow-visible"
        aria-hidden
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {ghostPts.length > 1 && (
          <path
            d={smoothPath(ghostPts)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.28}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {area && <path d={area} fill={`url(#${gid})`} />}
        {pts.length > 1 && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {last && (
        <span
          className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-cocoa dark:ring-sand-light"
          style={{ left: `${last[0]}%`, top: `${(last[1] / H) * 100}%`, background: color }}
        />
      )}
    </div>
  )
}

/** Winzige Linie (z. B. bester Satz je Session) für Listenzeilen. */
export function MiniSpark({
  values,
  width = 52,
  height = 20,
  highlight = false,
}: {
  values: number[]
  width?: number
  height?: number
  highlight?: boolean
}) {
  if (values.length < 2) {
    return <span className="block" style={{ width, height }} aria-hidden />
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 2.5
  const pts = values.map((v, i) => [
    pad + (i / (values.length - 1)) * (width - pad * 2),
    max === min ? height / 2 : height - pad - ((v - min) / span) * (height - pad * 2),
  ])
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
      <polyline
        points={pts.map((p) => p.join(',')).join(' ')}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={highlight ? 'stroke-gold' : 'stroke-brand'}
      />
      <circle cx={lx} cy={ly} r={2.25} className={highlight ? 'fill-gold' : 'fill-brand'} />
    </svg>
  )
}
