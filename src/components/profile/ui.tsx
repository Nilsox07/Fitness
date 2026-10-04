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
export function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
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
      {footer && <p className="px-4 text-xs leading-relaxed text-cocoa-muted">{footer}</p>}
    </section>
  )
}

/** Farbton der Icon-Kachel (wie iOS-Einstellungen, aber mit App-Tokens). */
export type RowTint = 'brand' | 'success' | 'gold' | 'sky' | 'violet' | 'neutral'

const TINT: Record<RowTint, string> = {
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success/15 text-success',
  gold: 'bg-gold/15 text-gold',
  sky: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  neutral: 'bg-sand text-cocoa-light',
}

/** Runde Icon-Kachel für Listenzeilen. */
export function IconTile({ icon: Icon, tint = 'brand' }: { icon: LucideIcon; tint?: RowTint }) {
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${TINT[tint]}`}>
      <Icon size={18} strokeWidth={2.2} />
    </span>
  )
}

/**
 * Listenzeile: Icon-Kachel + Label (+ Hinweis) + optionaler Wert rechts.
 * Mit `onClick` → tippbare Zeile mit Chevron; sonst `trailing` (z. B. Toggle).
 */
export function Row({
  icon: Icon,
  tint = 'brand',
  label,
  hint,
  value,
  onClick,
  trailing,
  danger,
}: {
  icon?: LucideIcon
  tint?: RowTint
  label: string
  hint?: string
  value?: ReactNode
  onClick?: () => void
  trailing?: ReactNode
  danger?: boolean
}) {
  const inner = (
    <>
      {Icon &&
        (danger ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/10 text-red-500 dark:text-red-400">
            <Icon size={18} strokeWidth={2.2} />
          </span>
        ) : (
          <IconTile icon={Icon} tint={tint} />
        ))}
      <div className="min-w-0 flex-1">
        <div
          className={`truncate text-[15px] font-semibold ${danger ? 'text-red-500 dark:text-red-400' : 'text-cocoa'}`}
        >
          {label}
        </div>
        {hint && <div className="text-xs leading-snug text-cocoa-light">{hint}</div>}
      </div>
      {value != null && value !== '' && (
        <span className="tabular min-w-0 max-w-[50%] truncate text-right text-sm text-cocoa-light">
          {value}
        </span>
      )}
      {trailing}
      {onClick && !danger && <ChevronRight size={16} className="shrink-0 text-cocoa-muted" />}
    </>
  )
  const cls = 'flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left'
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${cls} transition-colors duration-150 active:bg-sand-light`}
    >
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/** Kopfzeile einer Unterseite: runder Zurück-Button + großer Titel (+ Unterzeile). */
export function SubHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle?: ReactNode
  onBack: () => void
}) {
  return (
    <header className="flex items-center gap-3">
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
        onClick={onBack}
        aria-label="Zurück"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-sm text-cocoa-light">{subtitle}</p>}
      </div>
    </header>
  )
}

/** Weiße Abschnittskarte einer Unterseite (gleiche Rundung wie die Listen). */
export function SubCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-3 rounded-2xl bg-cream p-4 ${className}`}>{children}</div>
}
