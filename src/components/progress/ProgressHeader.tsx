import type { ReactNode } from 'react'
import { enter } from '../home/motion'
import { ProgressSwitch } from '../ProgressSwitch'

/** Kopf des Fortschritt-Tabs: großer Titel + Untertitel, rechts ein Slot, darunter Verlauf | Statistik. */
export function ProgressHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="space-y-3" style={enter(0)}>
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="tabular truncate text-sm text-cocoa-light">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      <ProgressSwitch />
    </div>
  )
}

/** Kleine Abschnitts-Überschrift (Versalien, gedämpft) mit optionalem rechten Slot. */
export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{children}</h2>
      {right}
    </div>
  )
}

/** Kompakter Segment-Schalter im Stil der TopBar (helle aktive Fläche, keine Signalfarbe). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label?: string
}) {
  return (
    <div className="flex gap-0.5 rounded-full bg-sand p-1" role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${
              active ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
