import { WEEKLY_GOAL } from '../../lib/duel'

/** Rundes Avatar (Maskottchen-Emoji oder Initiale). */
export function Avatar({
  emoji,
  name,
  size = 32,
  className = 'bg-sand',
}: {
  emoji?: string
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-cocoa ${className}`}
      style={{ width: size, height: size, fontSize: emoji ? size * 0.5 : size * 0.42 }}
      aria-hidden
    >
      {emoji || initial}
    </span>
  )
}

/** Avatar mit Wochenring (Trainings / Wochenziel); voll → grün. */
export function RingAvatar({
  emoji,
  name,
  sessions,
  size = 64,
  innerClassName = 'bg-cream',
}: {
  emoji?: string
  name?: string | null
  sessions: number
  size?: number
  innerClassName?: string
}) {
  const stroke = Math.max(3, Math.round(size / 20))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, sessions / WEEKLY_GOAL)
  const full = ratio >= 1
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-sand-dark/60"
        />
        {ratio > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            className={`transition-[stroke-dashoffset] duration-500 ${full ? 'stroke-success' : 'stroke-brand'}`}
          />
        )}
      </svg>
      <Avatar emoji={emoji} name={name} size={size - stroke * 2 - 6} className={innerClassName} />
    </span>
  )
}
