// Wirkung je Gewohnheit als Balken nach links (schlechter) bzw. rechts (besser) – wie stark, auf einen Blick.
// Antippen zeigt jeden Wert als Balkenpaar „mit“ gegen „ohne“.

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { hoursText } from '../../lib/health'
import { OUTCOME_LABEL, effectText, habitLabel, MIN_EACH, type Effect, type HabitImpact } from '../../lib/journal'
import { habitIcon } from './habitIcons'

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
      return `${v.toLocaleString('de-DE', { maximumFractionDigits: 1 })} / 5`
  }
}

/** Kurz für die Zahl rechts: „−45 min“, „−15 %“, „+3 bpm“ */
function effectShort(e: Effect): string {
  const sign = e.diff < 0 ? '−' : '+'
  const d = Math.abs(e.diff)
  switch (e.outcome) {
    case 'sleep':
    case 'deep':
      return `${sign}${Math.round(d)} min`
    case 'hrv':
      return `${sign}${Math.round((d / e.no) * 100)} %`
    case 'rhr':
      return `${sign}${Math.round(d)} bpm`
    case 'readiness':
      return `${sign}${Math.round(d)} Pkt.`
    case 'feel':
      return `${sign}${d.toLocaleString('de-DE', { maximumFractionDigits: 1 })}`
  }
}

export function impactLine(h: HabitImpact): string {
  if (h.status === 'learning') {
    const parts = [h.needYes > 0 && `${h.needYes}× mit`, h.needNo > 0 && `${h.needNo}× ohne`].filter(Boolean)
    return `Noch ${parts.join(' und ')} eintragen`
  }
  return h.main ? effectText(h.main) : 'Kein deutlicher Unterschied'
}

/** Balken ab der Mitte: links gold (schlechter), rechts grün (besser). */
function Diverging({ e }: { e: Effect | null }) {
  const w = e ? Math.max(6, (Math.min(e.score, 3) / 3) * 50) : 3
  const side = !e ? 'center' : e.better ? 'right' : 'left'
  return (
    <div className="relative h-2.5 rounded-full bg-sand">
      <span className="absolute inset-y-[-3px] left-1/2 w-px -translate-x-1/2 bg-cocoa-muted/50" />
      <span
        className={`absolute inset-y-0 rounded-full transition-all duration-700 ${
          side === 'center' ? 'bg-cocoa-muted/40' : side === 'right' ? 'bg-good' : 'bg-gold'
        }`}
        style={
          side === 'center'
            ? { left: `${50 - w / 2}%`, width: `${w}%` }
            : side === 'right'
              ? { left: '50%', width: `${w}%` }
              : { right: '50%', width: `${w}%` }
        }
      />
    </div>
  )
}

/** Fortschritt bis zur ersten Auswertung: Punkte für Tage mit/ohne */
function Dots({ n, label }: { n: number; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: MIN_EACH }, (_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < n ? 'bg-brand' : 'bg-sand-dark'}`} />
      ))}
      <span className="ml-0.5">{label}</span>
    </span>
  )
}

/** Balkenpaar mit/ohne für einen Wert */
function Pair({ e }: { e: Effect }) {
  const max = Math.max(e.yes, e.no) || 1
  const notable = e.score >= 1
  const color = notable ? (e.better ? 'bg-good' : 'bg-gold') : 'bg-cocoa-muted/50'
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-semibold">{OUTCOME_LABEL[e.outcome]}</span>
        <span
          className={`tabular font-semibold ${notable ? (e.better ? 'text-good' : 'text-gold') : 'text-cocoa-muted'}`}
        >
          {effectShort(e)}
        </span>
      </div>
      {(
        [
          ['mit', e.yes, color],
          ['ohne', e.no, 'bg-sand-dark'],
        ] as const
      ).map(([l, v, c]) => (
        <div key={l} className="mb-1 flex items-center gap-2 text-[11px]">
          <span className="w-8 shrink-0 text-cocoa-muted">{l}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
            <div className={`h-full rounded-full ${c}`} style={{ width: `${Math.max(4, (v / max) * 100)}%` }} />
          </div>
          <span className="tabular w-14 shrink-0 text-right">{value(e, v)}</span>
        </div>
      ))}
    </div>
  )
}

function Row({ h }: { h: HabitImpact }) {
  const [open, setOpen] = useState(false)
  const ready = h.status === 'ready'
  const main = ready ? h.main : null
  const Icon = habitIcon(h.habit)
  const tone = main ? (main.better ? 'text-good' : 'text-gold') : 'text-cocoa-muted'
  return (
    <div>
      <button
        className="block w-full px-4 py-3 text-left active:bg-sand/60 disabled:active:bg-transparent"
        onClick={() => setOpen((o) => !o)}
        disabled={!ready || h.effects.length === 0}
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
              main ? (main.better ? 'bg-good/15 text-good' : 'bg-gold/15 text-gold') : 'bg-sand text-cocoa-light'
            }`}
          >
            <Icon size={19} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{habitLabel(h.habit)}</span>
            <span className="block truncate text-xs text-cocoa-light">
              {main ? `${h.yesDays}× mit · ${h.noDays}× ohne` : impactLine(h)}
            </span>
          </span>
          {main && (
            <span className="shrink-0 text-right">
              <span className={`tabular block text-lg font-bold leading-tight ${tone}`}>{effectShort(main)}</span>
              <span className="block text-[10px] text-cocoa-muted">{OUTCOME_LABEL[main.outcome]}</span>
            </span>
          )}
          {ready && h.effects.length > 0 && (
            <ChevronDown size={16} className={`shrink-0 text-cocoa-muted transition ${open ? 'rotate-180' : ''}`} />
          )}
        </span>
        <span className="mt-2.5 block pl-[3.25rem]">
          {ready ? (
            <Diverging e={main} />
          ) : (
            <span className="flex gap-4 text-[11px] text-cocoa-muted">
              <Dots n={h.yesDays} label="mit" />
              <Dots n={h.noDays} label="ohne" />
            </span>
          )}
        </span>
      </button>
      {open && ready && (
        <div className="space-y-3 px-4 pb-4 pl-[4.25rem]">
          {h.effects.map((e) => (
            <Pair key={e.outcome} e={e} />
          ))}
          <p className="text-[11px] text-cocoa-muted">
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
    <div className="overflow-hidden rounded-2xl bg-cream">
      <div className="flex justify-between px-4 pb-1 pt-3 pl-[4.25rem] text-[10px] font-semibold uppercase tracking-wide text-cocoa-muted">
        <span>← schlechter</span>
        <span>besser →</span>
      </div>
      <div className="divide-y divide-sand-dark/40">
        {impacts.map((h) => (
          <Row key={h.habit} h={h} />
        ))}
      </div>
    </div>
  )
}
