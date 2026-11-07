// Wirkung je Gewohnheit: Hauptbefund in einer Zeile, antippen zeigt alle Werte (mit vs. ohne).

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Group } from '../health/ui'
import { hoursText } from '../../lib/health'
import { OUTCOME_LABEL, effectText, habitLabel, type Effect, type HabitImpact } from '../../lib/journal'

function value(e: Effect, v: number): string {
  switch (e.outcome) {
    case 'sleep':
    case 'deep':
      return hoursText(Math.round(v))
    case 'hrv':
      return `${Math.round(v)} ms`
    case 'rhr':
      return `${Math.round(v)} bpm`
    case 'readiness':
      return `${Math.round(v)}`
    case 'feel':
      return v.toLocaleString('de-DE', { maximumFractionDigits: 1 })
  }
}

export function impactLine(h: HabitImpact): string {
  if (h.status === 'learning') {
    const parts = [h.needYes > 0 && `${h.needYes}× mit`, h.needNo > 0 && `${h.needNo}× ohne`].filter(Boolean)
    return `Noch ${parts.join(' und ')} eintragen`
  }
  return h.main ? effectText(h.main) : 'Kein deutlicher Unterschied'
}

function Row({ h }: { h: HabitImpact }) {
  const [open, setOpen] = useState(false)
  const ready = h.status === 'ready'
  const tone = ready && h.main ? (h.main.better ? 'text-good' : 'text-gold') : 'text-cocoa-light'
  return (
    <div>
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sand/60 disabled:active:bg-transparent"
        onClick={() => setOpen((o) => !o)}
        disabled={!ready || h.effects.length === 0}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{habitLabel(h.habit)}</span>
          <span className={`block truncate text-sm ${tone}`}>{impactLine(h)}</span>
        </span>
        {ready && h.effects.length > 0 && (
          <ChevronDown size={18} className={`shrink-0 text-cocoa-muted transition ${open ? 'rotate-180' : ''}`} />
        )}
      </button>
      {open && ready && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs">
            <span />
            <span className="text-right font-semibold text-cocoa-muted">mit</span>
            <span className="text-right font-semibold text-cocoa-muted">ohne</span>
            {h.effects.map((e) => (
              <div key={e.outcome} className="contents">
                <span className="text-cocoa-light">{OUTCOME_LABEL[e.outcome]}</span>
                <span
                  className={`tabular text-right font-semibold ${e.score >= 1 ? (e.better ? 'text-good' : 'text-gold') : ''}`}
                >
                  {value(e, e.yes)}
                </span>
                <span className="tabular text-right">{value(e, e.no)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-cocoa-muted">
            {h.yesDays} Tage mit, {h.noDays} ohne · Werte am Morgen danach
          </p>
        </div>
      )}
    </div>
  )
}

export function HabitImpactList({ impacts }: { impacts: HabitImpact[] }) {
  if (!impacts.length) return null
  return (
    <Group>
      {impacts.map((h) => (
        <Row key={h.habit} h={h} />
      ))}
    </Group>
  )
}
