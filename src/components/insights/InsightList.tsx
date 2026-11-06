// Erkenntnis-Karten: neutrales Symbol, eine Zeile Überschrift, eine Zeile Wert,
// Erklärung erst beim Antippen (i). Punkt rechts: grün = gut, gold = Hinweis.

import { useState } from 'react'
import {
  Activity,
  BedDouble,
  CalendarDays,
  Clock,
  Flame,
  Footprints,
  Gauge,
  HeartPulse,
  Hourglass,
  Info,
  Link2,
  Sparkles,
  WavesHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Group, IconBox } from '../health/ui'
import type { Insight, InsightIcon, InsightViz } from '../../lib/insights'

const ICONS: Record<InsightIcon, LucideIcon> = {
  load: Gauge,
  heart: HeartPulse,
  hrv: WavesHorizontal,
  vo2: Activity,
  age: Hourglass,
  sleep: BedDouble,
  clock: Clock,
  calendar: CalendarDays,
  steps: Footprints,
  zap: Zap,
  flame: Flame,
  link: Link2,
  mind: Sparkles,
}

export function InsightRow({ insight: x }: { insight: Insight }) {
  const [open, setOpen] = useState(false)
  const Icon = ICONS[x.icon] ?? Sparkles
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className="flex w-full items-start gap-3 px-4 py-3 text-left active:bg-sand/60"
    >
      <IconBox>
        <Icon size={18} />
      </IconBox>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-semibold">{x.title}</span>
          {x.tone !== 'neutral' && (
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${x.tone === 'good' ? 'bg-good' : 'bg-gold'}`}
              aria-label={x.tone === 'good' ? 'Gut' : 'Hinweis'}
            />
          )}
        </span>
        <span className="tabular block truncate text-sm text-cocoa-light">{x.value}</span>
        {x.viz && <VizLine viz={x.viz} />}
        {open && <span className="anim-fade mt-1.5 block text-xs leading-snug text-cocoa-light">{x.info}</span>}
      </span>
      <Info size={15} className="mt-0.5 shrink-0 text-cocoa-muted" aria-label="Mehr erfahren" />
    </button>
  )
}

const de = (v: number, d = 0) => v.toLocaleString('de-DE', { maximumFractionDigits: d })

/** Kleine Grafik unter dem Wert: Skala mit Ziel-/Idealbereich oder zwei Werte im Vergleich. */
function VizLine({ viz }: { viz: InsightViz }) {
  if (viz.kind === 'meter') {
    const pct = (v: number) => Math.min(100, Math.max(0, (v / (viz.max || 1)) * 100))
    const lo = viz.lo != null ? pct(viz.lo) : null
    const hi = viz.hi != null ? pct(viz.hi) : null
    return (
      <span className="relative mt-1.5 block h-1.5 max-w-[15rem] rounded-full bg-sand" aria-hidden>
        {lo != null && hi != null && (
          <span
            className="absolute inset-y-0 rounded-full bg-sand-dark"
            style={{ left: `${lo}%`, width: `${hi - lo}%` }}
          />
        )}
        {lo != null && hi != null ? (
          <span
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-cream"
            style={{ left: `${pct(viz.value)}%` }}
          />
        ) : (
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-brand/70"
            style={{ width: `${pct(viz.value)}%` }}
          />
        )}
        {lo != null && hi == null && (
          <span className="absolute -inset-y-0.5 w-0.5 rounded-full bg-cocoa" style={{ left: `${lo}%` }} />
        )}
      </span>
    )
  }
  const max = Math.max(viz.a.value, viz.b.value, 1)
  return (
    <span className="mt-1.5 grid max-w-[15rem] grid-cols-[3.75rem_1fr] items-center gap-x-2 gap-y-0.5" aria-hidden>
      {[viz.a, viz.b].map((p, i) => (
        <span key={p.label} className="contents">
          <span className="truncate text-[10px] text-cocoa-muted">{p.label}</span>
          <span className="flex items-center gap-1.5">
            <span
              className={`h-1.5 rounded-full ${i === 0 ? 'bg-brand/70' : 'bg-sand-dark'}`}
              style={{ width: `${Math.max(4, (p.value / max) * 75)}%` }}
            />
            <span className="tabular shrink-0 text-[10px] text-cocoa-light">
              {de(p.value)} {viz.unit}
            </span>
          </span>
        </span>
      ))}
    </span>
  )
}

/** Gruppierte Liste von Erkenntnissen (untereinander, kein Wischen). */
export function InsightList({ items, style }: { items: readonly Insight[]; style?: React.CSSProperties }) {
  return (
    <Group style={style}>
      {items.map((x) => (
        <InsightRow key={x.id} insight={x} />
      ))}
    </Group>
  )
}
