import type { CSSProperties, ReactNode } from 'react'
import { ProgressSwitch } from '../ProgressSwitch'

/** Großer Seitentitel mit gedämpfter Unterzeile (wie auf den neuen Startseiten). */
export function PageHeader({ title, subtitle, style }: { title: string; subtitle?: ReactNode; style?: CSSProperties }) {
  return (
    <header style={style} className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="tabular text-sm text-cocoa-light">{subtitle}</p>}
      </div>
      {/* Wie bei Fitness: Titel oben, darunter der Umschalter Tage | Statistik */}
      <ProgressSwitch />
    </header>
  )
}

/** Kleine Abschnittsüberschrift in Versalien. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{children}</h2>
      {right && <span className="tabular text-xs text-cocoa-muted">{right}</span>}
    </div>
  )
}
