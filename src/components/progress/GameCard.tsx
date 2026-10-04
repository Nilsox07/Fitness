import type { CSSProperties, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Ring } from '../nutrition-home/Ring'

/**
 * Kompakte Gamification-Karte im Premium-Stil: Maskottchen im XP-Ring, Level
 * und Kennzahlen; aufgeklappt folgen die bestehenden Panels.
 */
export function GameCard({
  mascot,
  title,
  subtitle,
  progress,
  meta,
  open,
  onToggle,
  style,
  children,
}: {
  mascot: string
  title: string
  subtitle: string
  /** 0…100 */
  progress: number
  meta: ReactNode
  open: boolean
  onToggle: () => void
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <section className="space-y-5" style={style}>
      <button
        className="card flex w-full items-center gap-3.5 text-left transition active:scale-[0.99]"
        onClick={onToggle}
        aria-expanded={open}
      >
        <Ring size={56} stroke={4} progress={progress / 100} trackClass="stroke-sand-dark/45">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-sand text-2xl leading-none">
            {mascot}
          </span>
        </Ring>
        <span className="min-w-0 flex-1">
          <span className="tabular block truncate font-bold text-cocoa">{title}</span>
          <span className="tabular block truncate text-xs text-cocoa-light">{subtitle}</span>
          <span className="tabular mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-cocoa-light">
            {meta}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-cocoa-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {/* Bleibt gemountet, damit Effekte (z. B. Freeze-Vergabe) weiterlaufen. */}
      <div className={open ? 'anim-fade space-y-5' : 'hidden'}>{children}</div>
    </section>
  )
}

/** Kleiner Chip für die Meta-Zeile der GameCard. */
export function MetaChip({ children }: { children: ReactNode }) {
  return <span className="flex items-center gap-1 rounded-full bg-sand px-2 py-0.5">{children}</span>
}
