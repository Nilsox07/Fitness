import type { MovementCategory } from '../../lib/analytics'
import type { MuscleGroup } from '../../types'
import { CATEGORY_LABEL, CATEGORY_TINT, muscleAbbr, muscleTint } from './muscle'

/** Kleiner, farbig getönter Muskel-Chip. `onDark`: für die dunkle Hero-Karte. */
export function MuscleChip({
  muscle,
  onDark = false,
  size = 'sm',
}: {
  muscle: MuscleGroup
  onDark?: boolean
  size?: 'xs' | 'sm'
}) {
  const t = muscleTint(muscle)
  const pad = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium ${pad} ${
        onDark ? 'bg-bg/10 text-bg/85 dark:bg-white/5 dark:text-cocoa' : `${t.soft} text-cocoa`
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${t.solid}`} />
      {muscle}
    </span>
  )
}

/** Rundes Avatar mit Muskel-Kürzel, getönt nach Bewegungskategorie. */
export function MuscleAvatar({ muscle, size = 40 }: { muscle: MuscleGroup; size?: number }) {
  const t = muscleTint(muscle)
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-[13px] font-bold tracking-tight ${t.soft} ${t.text}`}
      style={{ width: size, height: size }}
      title={muscle}
      aria-hidden
    >
      {muscleAbbr(muscle)}
    </span>
  )
}

/** Abdeckungs-Balken: Anteile Drücken/Ziehen/Beine/Rumpf als segmentierte Leiste. */
export function CoverageBar({
  shares,
  onDark = false,
  className = '',
}: {
  shares: { category: MovementCategory; share: number }[]
  onDark?: boolean
  className?: string
}) {
  if (shares.length === 0) return null
  return (
    <div
      className={`flex h-1.5 gap-0.5 overflow-hidden rounded-full ${onDark ? 'bg-bg/10 dark:bg-white/5' : 'bg-sand'} ${className}`}
      role="img"
      aria-label={
        'Muskel-Abdeckung: ' +
        shares.map((s) => `${CATEGORY_LABEL[s.category]} ${Math.round(s.share * 100)} %`).join(', ')
      }
    >
      {shares.map((s) => (
        <span
          key={s.category}
          className={`h-full rounded-full ${CATEGORY_TINT[s.category].solid}`}
          style={{ width: `${s.share * 100}%` }}
        />
      ))}
    </div>
  )
}

/** Mini-Verlaufslinie (Inline-SVG) mit betontem Endpunkt. */
export function Sparkline({
  values,
  width = 52,
  height = 22,
  strokeClass = 'stroke-brand',
  fillClass = 'fill-brand',
}: {
  values: number[]
  width?: number
  height?: number
  strokeClass?: string
  fillClass?: string
}) {
  if (values.length < 2) return null
  const pad = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = (width - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => {
    const x = pad + i * step
    const y = max === min ? height / 2 : pad + (1 - (v - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible" aria-hidden>
      <polyline
        points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${strokeClass} opacity-80`}
      />
      <circle cx={lx} cy={ly} r={2.5} className={fillClass} />
    </svg>
  )
}
