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
import type { Insight, InsightIcon } from '../../lib/insights'

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
        {open && <span className="anim-fade mt-1.5 block text-xs leading-snug text-cocoa-light">{x.info}</span>}
      </span>
      <Info size={15} className="mt-0.5 shrink-0 text-cocoa-muted" aria-label="Mehr erfahren" />
    </button>
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
