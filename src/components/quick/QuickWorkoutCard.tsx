import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Zap } from 'lucide-react'

/**
 * Einstieg ins Schnell-Workout (z. B. für Start-Screen oder Pläne).
 * `preset` startet direkt eine Vorlage (`classic7`, `core10`, `legs15`, `full20`).
 */
export function QuickWorkoutCard({
  title = 'Schnell-Workout',
  subtitle = 'Keine Zeit? 5–30 Min, auch ohne Geräte',
  preset,
  style,
  className = '',
}: {
  title?: string
  subtitle?: string
  preset?: string
  style?: CSSProperties
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(preset ? `/quick?preset=${encodeURIComponent(preset)}` : '/quick')}
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-cream px-4 py-3 text-left transition active:scale-[0.99] ${className}`}
      style={style}
    >
      <span className="pointer-events-none absolute -left-6 -top-6 h-16 w-16 rounded-full bg-brand/15 blur-xl" aria-hidden />
      <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-on-brand shadow-md shadow-brand/25">
        <Zap size={18} strokeWidth={2.5} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-cocoa">{title}</span>
        <span className="block truncate text-xs text-cocoa-light">{subtitle}</span>
      </span>
      <ChevronRight size={16} className="relative shrink-0 text-cocoa-muted" />
    </button>
  )
}
