import type { ReactNode } from 'react'
import { AlertCircle, ChevronRight } from 'lucide-react'

/** Gruppierte Liste (iOS-Stil): eine Karte, Zeilen durch feine Linien getrennt. */
export function GroupList({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream ${className}`}>{children}</div>
  )
}

/** Kleine Abschnittsüberschrift in Versalien (wie SectionTitle). */
export function GroupLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-cocoa-muted">{children}</h3>
      {right && <span className="tabular text-xs text-cocoa-muted">{right}</span>}
    </div>
  )
}

const ROW =
  'flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-sand-light disabled:opacity-50'

function RowInner({
  icon,
  title,
  subtitle,
  right,
  accent,
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  accent?: boolean
}) {
  return (
    <>
      {icon && (
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
            accent ? 'bg-brand text-on-brand' : 'bg-brand/10 text-brand'
          }`}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-cocoa">{title}</span>
        {subtitle && <span className="tabular block truncate text-xs text-cocoa-light">{subtitle}</span>}
      </span>
      {right === undefined ? <ChevronRight size={16} className="shrink-0 text-cocoa-muted" /> : right}
    </>
  )
}

/** Tippbare Listenzeile mit Icon-Kachel, Titel, Unterzeile und rechtem Element (Standard: Pfeil). */
export function GroupRow({
  onClick,
  disabled,
  ...inner
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  accent?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" className={ROW} onClick={onClick} disabled={disabled}>
      <RowInner {...inner} />
    </button>
  )
}

/** Wie GroupRow, aber als <label> um ein (verstecktes) Datei-Eingabefeld. */
export function GroupFileRow({
  input,
  ...inner
}: {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  accent?: boolean
  input: ReactNode
}) {
  return (
    <label className={`${ROW} cursor-pointer`}>
      <RowInner {...inner} />
      {input}
    </label>
  )
}

/** Dezente Fehlermeldung (inline). */
export function ErrorNote({ error, className = '' }: { error: string | null | undefined; className?: string }) {
  if (!error) return null
  return (
    <p
      role="alert"
      className={`anim-fade flex items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600 dark:text-red-400 ${className}`}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span className="min-w-0">{error}</span>
    </p>
  )
}

/** Großes Eingabefeld für Sheets/Formulare der neuen App. */
export const BIG_INPUT = 'input rounded-2xl py-3 text-base'
