import type { ReactNode } from 'react'

/** Freischaltbare Hintergründe hinter Buddy (rund oder als Fläche). */
export const BACKDROPS: Record<string, { label: string; className: string; deco: ReactNode }> = {
  night: {
    label: 'Gym bei Nacht',
    className: 'bg-gradient-to-b from-[#0B1026] via-[#1E1B4B] to-[#312E81]',
    deco: (
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {[
          [12, 14, 1.2],
          [30, 8, 0.9],
          [52, 18, 1.4],
          [74, 10, 1],
          [88, 24, 1.2],
          [20, 30, 0.8],
          [64, 28, 0.8],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.8} />
        ))}
        <circle cx={82} cy={14} r={6} fill="#FDE68A" opacity={0.9} />
        <rect x={0} y={84} width={100} height={16} fill="#111827" opacity={0.6} />
        <rect x={10} y={78} width={3} height={8} fill="#9CA3AF" />
        <rect x={6} y={77} width={11} height={2} fill="#6B7280" />
        <rect x={86} y={78} width={3} height={8} fill="#9CA3AF" />
        <rect x={82} y={77} width={11} height={2} fill="#6B7280" />
      </svg>
    ),
  },
  beach: {
    label: 'Strand',
    className: 'bg-gradient-to-b from-[#7DD3FC] via-[#BAE6FD] to-[#FDE68A]',
    deco: (
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx={80} cy={18} r={9} fill="#FBBF24" />
        <path d="M0 70Q25 64 50 70T100 70V82H0Z" fill="#38BDF8" opacity={0.7} />
        <rect x={0} y={80} width={100} height={20} fill="#FCD34D" />
        <path d="M14 80Q12 60 18 46" stroke="#92400E" strokeWidth={2} fill="none" />
        <path
          d="M18 46Q8 44 4 50M18 46Q26 40 32 44M18 46Q16 38 22 34"
          stroke="#16A34A"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  space: {
    label: 'Weltall',
    className: 'bg-gradient-to-br from-[#020617] via-[#1E1B4B] to-[#581C87]',
    deco: (
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 37) % 100}
            cy={(i * 53) % 100}
            r={i % 3 === 0 ? 1.1 : 0.6}
            fill="#fff"
            opacity={0.85}
          />
        ))}
        <circle cx={18} cy={78} r={12} fill="#F472B6" opacity={0.85} />
        <ellipse cx={18} cy={78} rx={19} ry={4} fill="none" stroke="#FBCFE8" strokeWidth={1.4} opacity={0.8} />
        <circle cx={84} cy={20} r={5} fill="#60A5FA" />
      </svg>
    ),
  },
}

/** Rahmt Buddy mit dem gewählten Hintergrund ein (ohne Hintergrund: unverändert). */
export function BuddyBackdrop({
  background,
  className = '',
  children,
}: {
  background?: string
  className?: string
  children: ReactNode
}) {
  const bd = background ? BACKDROPS[background] : undefined
  if (!bd) return <>{children}</>
  return (
    <div className={`relative grid place-items-center overflow-hidden ${bd.className} ${className}`}>
      {bd.deco}
      <div className="relative">{children}</div>
    </div>
  )
}
