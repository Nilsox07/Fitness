// Gemeinsame Bausteine der Uhr-Seiten – exakt im Stil der übrigen App
// (dunkle Hero-Karte wie „Volumen“ im Kraft-Fortschritt, gruppierte Listen, Rubin als einzige Akzentfarbe).

import { BuddyLine, HeroWithBuddy, type HeroBuddyData } from '../home/HeroBuddy'
import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { enter } from '../home/motion'

/** Dunkle Hero-Karte mit Überschrift, großer Zahl und Inhalt. */
export function Hero({
  overline,
  value,
  unit,
  right,
  children,
  index = 1,
  buddy,
}: {
  overline: ReactNode
  value?: ReactNode
  unit?: ReactNode
  right?: ReactNode
  children?: ReactNode
  index?: number
  /** Buddy lugt über die Karte, sein Spruch steht oben (einheitlich in allen Tabs) */
  buddy?: HeroBuddyData
}) {
  return (
    <div style={enter(index)}>
      <HeroWithBuddy buddy={buddy}>
        <section className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
          <div className="relative">
            {buddy && <BuddyLine line={buddy.line} tone="dark" onClick={buddy.onLine} />}
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
                {overline}
              </p>
              {right}
            </div>
            {value != null && (
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="tabular text-5xl font-bold tracking-tight">{value}</span>
                {unit && <span className="text-xl font-semibold text-bg/60 dark:text-cocoa-light">{unit}</span>}
              </p>
            )}
            {children}
          </div>
        </section>
      </HeroWithBuddy>
    </div>
  )
}

/** Kennzahl-Kachel in der Hero-Karte (wie „Trainings · Sätze · Rekorde“). */
export function HeroPill({ value, label, icon }: { value: ReactNode; label: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-bg/10 px-3 py-2.5 dark:bg-white/5">
      <div className="tabular flex items-center gap-1.5 truncate text-lg font-bold leading-tight">
        {icon}
        {value}
      </div>
      <div className="truncate text-[11px] text-bg/60 dark:text-cocoa-light">{label}</div>
    </div>
  )
}

/** Gruppierte Liste (wie „Übungen“) – Zeilen mit Trennlinien. */
export function Group({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="divide-y divide-sand-dark/40 overflow-hidden rounded-2xl bg-cream" style={style}>
      {children}
    </div>
  )
}

/** Zeile einer gruppierten Liste: Titel, Untertitel, Wert rechts, optional tippbar. */
export function GroupRow({
  title,
  sub,
  right,
  leading,
  onClick,
}: {
  title: ReactNode
  sub?: ReactNode
  right?: ReactNode
  leading?: ReactNode
  onClick?: () => void
}) {
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {sub && <span className="block truncate text-sm text-cocoa-light">{sub}</span>}
      </span>
      {right}
      {onClick && <ChevronRight size={18} className="shrink-0 text-cocoa-muted" />}
    </>
  )
  return onClick ? (
    <button className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sand/60" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
  )
}

/** Wert-Kachel innerhalb einer hellen Karte. */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-sand-light px-3 py-2.5 dark:bg-sand">
      <div className="tabular truncate text-base font-bold">{value}</div>
      <div className="truncate text-[11px] text-cocoa-muted">{label}</div>
    </div>
  )
}

/** Neutrales Symbol-Kästchen (wie bei den Mahlzeiten). */
export function IconBox({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sand text-cocoa-light">{children}</span>
  )
}

/** Rubin in Abstufungen (0–1) – statt bunter Einzelfarben. */
export const ruby = (a = 1) => `rgb(var(--c-ruby) / ${a})`
