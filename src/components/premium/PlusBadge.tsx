import { Lock } from 'lucide-react'

/** Kleines „Plus“-Schild für KI-Funktionen in der kostenlosen Version. */
export function PlusBadge({ className = '', onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide ${
        onDark ? 'bg-on-brand/20 text-on-brand' : 'bg-brand/10 text-brand'
      } ${className}`}
      aria-label="Buddy Plus"
    >
      <Lock size={9} strokeWidth={3} />
      Plus
    </span>
  )
}
