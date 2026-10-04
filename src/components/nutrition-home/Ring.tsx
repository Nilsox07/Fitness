import type { ReactNode } from 'react'

/**
 * Kreisförmiger Fortschritt (SVG). `progress` 0…1 füllt den Ring, Werte > 1
 * zeichnen den Überschuss als zweiten Bogen (`overClass`) darüber.
 */
export function Ring({
  size,
  stroke,
  progress,
  trackClass = 'stroke-sand-dark/50',
  barClass = 'stroke-brand',
  overClass = 'stroke-gold',
  transition = true,
  children,
  className = '',
}: {
  size: number
  stroke: number
  progress: number
  trackClass?: string
  barClass?: string
  overClass?: string
  /** dashoffset weich animieren (aus, wenn der Wert schon selbst animiert wird) */
  transition?: boolean
  children?: ReactNode
  className?: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = Number.isFinite(progress) ? Math.max(0, progress) : 0
  const main = Math.min(1, p)
  const over = Math.min(1, Math.max(0, p - 1))
  const trans = transition ? 'transition-[stroke-dashoffset] duration-500 ease-out' : ''
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        {main > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - main)}
            className={`${barClass} ${trans}`}
          />
        )}
        {over > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - over)}
            className={`${overClass} ${trans}`}
          />
        )}
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  )
}
