import type { CSSProperties, ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/** Großer Seitentitel + gedämpfte Unterzeile; links optional Zurück, rechts ein Aktions-Slot. */
export function PageHeader({
  title,
  subtitle,
  action,
  onBack,
  style,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  onBack?: () => void
  style?: CSSProperties
}) {
  return (
    <header className="flex items-center gap-3" style={style}>
      {onBack && (
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sand text-cocoa transition active:scale-90"
          onClick={onBack}
          aria-label="Zurück"
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="tabular truncate text-sm text-cocoa-light">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

/** Kleine Abschnittsüberschrift in Versalien mit optionalem rechten Slot. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{children}</h2>
      {typeof right === 'string' ? <span className="tabular text-xs text-cocoa-muted">{right}</span> : right}
    </div>
  )
}

/** Runde Filter-Chips (aktiv = dunkle Fläche). */
export function FilterChips<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string; icon?: ReactNode }[]
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 ${
              active ? 'bg-cocoa text-cream' : 'bg-sand text-cocoa-light'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
