import { useState, type ReactNode } from 'react'
import { accentColor } from '../../lib/cosmetics'
import { ChevronDown, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { useTheme } from '../../lib/theme'
import { PERIOD_LABELS, type Period } from '../../lib/periods'

/** Diagramm-Farben passend zum aktiven Theme (wie bisher in der Auswertung). */
export function useChartTheme() {
  const dark = useTheme().resolved === 'dark'
  const c = {
    grid: dark ? '#243044' : '#E5E7EB',
    axis: dark ? '#94A3B8' : '#5B6472',
    muted: dark ? '#64748B' : '#8A92A0',
    tipBg: dark ? '#161D2B' : '#FFFFFF',
    tipBorder: dark ? '#344155' : '#D2D6DD',
    tipText: dark ? '#E5E9F0' : '#0B0F19',
    primary: accentColor(),
  }
  return {
    ...c,
    axisStyle: { fontSize: 11, fill: c.axis },
    tooltip: {
      contentStyle: {
        background: c.tipBg,
        border: `1px solid ${c.tipBorder}`,
        color: c.tipText,
        borderRadius: 8,
        fontSize: 12,
      },
      labelStyle: { color: c.tipText },
      cursor: { fill: dark ? 'rgba(148,163,184,0.12)' : 'rgba(91,100,114,0.08)' },
    },
  }
}

export const nf = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

/** Signierte Zahl mit echtem Minuszeichen, z. B. „−0,6". */
export const signed = (n: number, digits = 1) =>
  `${n > 0 ? '+' : n < 0 ? '−' : '±'}${nf(Math.abs(n), digits)}`

export function PeriodSwitch({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex gap-1 rounded-full bg-sand p-1" role="tablist">
      {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => {
        const active = p === value
        return (
          <button
            key={p}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={`flex-1 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
              active ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        )
      })}
    </div>
  )
}

/** Veränderung ggü. dem Vorzeitraum — steigend grün, fallend neutral (kein Rot). */
export function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[11px] text-cocoa-muted">–</span>
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  return (
    <span
      className={`tabular inline-flex items-center gap-0.5 text-[11px] font-semibold ${
        pct > 0 ? 'text-success' : 'text-cocoa-light'
      }`}
    >
      <Icon size={12} />
      {nf(Math.abs(pct))} %
    </span>
  )
}

export function KpiTile({
  label,
  value,
  unit,
  footer,
  valueClass = 'text-cocoa',
}: {
  label: string
  value: string
  unit?: string
  footer?: ReactNode
  valueClass?: string
}) {
  return (
    <div className="rounded-2xl bg-cream px-3 py-2.5">
      <div className="truncate text-xs text-cocoa-light">{label}</div>
      <div className={`tabular mt-0.5 text-2xl font-bold leading-tight ${valueClass}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-semibold text-cocoa-light">{unit}</span>}
      </div>
      {footer && <div className="mt-0.5">{footer}</div>}
    </div>
  )
}

/**
 * Kompakte, aufklappbare Gamification-Karte: eine Zeile mit Maskottchen, Level,
 * XP-Balken und Kennzahlen; aufgeklappt folgen die bestehenden Panels.
 */
export function GameSummaryCard({
  mascot,
  title,
  progress,
  meta,
  open,
  onToggle,
  children,
}: {
  mascot: string
  title: string
  progress: number
  meta: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className="space-y-5">
      <button
        className="card flex w-full items-center gap-3 text-left"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="text-3xl leading-none">{mascot}</span>
        <span className="min-w-0 flex-1">
          <span className="tabular block text-sm font-bold text-cocoa">{title}</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sand-dark/40">
            <span className="block h-full bg-brand" style={{ width: `${progress}%` }} />
          </span>
          <span className="tabular mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-cocoa-light">
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

/** Lokaler Auf-/Zu-Zustand; öffnet automatisch, wenn ein Level-up ansteht. */
export function useGameToggle(level: number, storageKey: string) {
  const [open, setOpen] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)
  let seen = 1
  try {
    seen = Number(localStorage.getItem(storageKey) || '1')
  } catch {
    /* ignore */
  }
  // Level-up steht an → einmalig aufklappen, damit die Feier sichtbar ist.
  if (!autoOpened && level > 1 && level > seen && !open) {
    setAutoOpened(true)
    setOpen(true)
  }
  return { open, toggle: () => setOpen((o) => !o) }
}
