import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

/** iOS-artiger Schalter: an = success, aus = sand-dark. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-success' : 'bg-sand-dark'
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

/** Segment-Schalter wie in der TopBar: ausgewählt = helle Fläche auf bg-sand-Spur. */
export const SEG_TRACK = 'grid gap-1 rounded-full bg-sand p-1'
export const segBtn = (active: boolean, size = 'text-sm') =>
  `rounded-full px-2 py-1.5 ${size} font-semibold transition-colors duration-200 ${
    active ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
  }`
export const TILE = 'btn gap-1.5 bg-sand text-cocoa'

/** Gruppierte Liste im iOS-Stil mit kleiner Überschrift. */
export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      {title && (
        <h2 className="px-4 text-xs font-semibold uppercase tracking-wide text-cocoa-muted">
          {title}
        </h2>
      )}
      <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream">
        {children}
      </div>
    </section>
  )
}

/**
 * Listenzeile: Icon + Label (+ Hinweis) + optionaler Wert rechts.
 * Mit `onClick` → tippbare Zeile mit Chevron; sonst `trailing` (z. B. Toggle).
 */
export function Row({
  icon: Icon,
  label,
  hint,
  value,
  onClick,
  trailing,
  danger,
}: {
  icon?: LucideIcon
  label: string
  hint?: string
  value?: ReactNode
  onClick?: () => void
  trailing?: ReactNode
  danger?: boolean
}) {
  const inner = (
    <>
      {Icon && (
        <Icon size={18} className={`shrink-0 ${danger ? 'text-brand' : 'text-cocoa-light'}`} />
      )}
      <div className="min-w-0 flex-1">
        <div className={`font-medium ${danger ? 'text-brand' : 'text-cocoa'}`}>{label}</div>
        {hint && <div className="text-xs text-cocoa-light">{hint}</div>}
      </div>
      {value != null && value !== '' && (
        <span className="min-w-0 max-w-[55%] truncate text-right text-sm text-cocoa-light">
          {value}
        </span>
      )}
      {trailing}
      {onClick && !danger && <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />}
    </>
  )
  const cls = 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left'
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${cls} transition-colors duration-150 active:bg-sand/60`}
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/** Kopfzeile einer Unterseite: runder Zurück-Button + Titel. */
export function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-full bg-sand text-cocoa"
        onClick={onBack}
        aria-label="Zurück"
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-xl font-bold">{title}</h1>
    </header>
  )
}
