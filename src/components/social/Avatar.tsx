import { WEEKLY_GOAL } from '../../lib/duel'
import { Buddy } from '../buddy/Buddy'
import type { BuddyLook } from './format'

/** Rundes Avatar: Buddy-Figur (aus den geteilten Stats) oder Initiale. */
export function Avatar({
  buddy,
  name,
  size = 32,
  className = 'bg-sand',
}: {
  buddy?: BuddyLook
  name?: string | null
  size?: number
  className?: string
}) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase()
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold text-cocoa ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden
    >
      {buddy ? (
        // Kleine Avatare in Listen: statisch (keine Animation)
        <Buddy size={size + 2} stage={buddy.stage} mood={buddy.mood} skin={buddy.skin} animate={false} />
      ) : (
        initial
      )}
    </span>
  )
}

/** Avatar mit Wochenring (Trainings / Wochenziel); voll → grün. Mit `buddy` als Buddy-Figur. */
export function RingAvatar({
  name,
  sessions,
  size = 64,
  innerClassName = 'bg-cream',
  buddy,
}: {
  name?: string | null
  sessions: number
  size?: number
  innerClassName?: string
  buddy?: BuddyLook
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
      {buddy ? (
        <span
          className={`grid shrink-0 place-items-center rounded-full ${innerClassName}`}
          style={{ width: size - stroke * 2 - 6, height: size - stroke * 2 - 6 }}
        >
          <Buddy size={size - stroke * 2 - 4} stage={buddy.stage} mood={buddy.mood} skin={buddy.skin} />
        </span>
      ) : (
        <Avatar name={name} size={size - stroke * 2 - 6} className={innerClassName} />
      )}
    </span>
  )
}
