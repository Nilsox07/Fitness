// „Was deine Tagesform beeinflusst“ als Beitrags-Diagramm: jeder Faktor ein Balken von der Mitte aus
// (rechts/grün hebt, links/gold senkt), Wert und Vergleich in einer Zeile; Details erst beim Antippen.

import { useState } from 'react'
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BedDouble,
  Beef,
  CalendarHeart,
  ChevronDown,
  Droplet,
  Dumbbell,
  Flame,
  HeartPulse,
  Info,
  Moon,
  WavesHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { FACTOR_INFO, type Readiness, type ReadinessFactor } from '../../lib/health'
import { InfoTip } from '../ui/InfoTip'
import { ImpactBar, RangeBar, StatusChip } from './Charts'

/** Startwert der Tagesform, bevor die Faktoren sie heben oder senken (wie in readiness()). */
const BASE = 72

export const FACTOR_ICON: Record<ReadinessFactor['key'], LucideIcon> = {
  sleep: BedDouble,
  deep: Moon,
  hrv: WavesHorizontal,
  rhr: HeartPulse,
  load: Activity,
  strength: Dumbbell,
  energy: Flame,
  protein: Beef,
  water: Droplet,
  cycle: CalendarHeart,
}

/** Beschriftung des hinterlegten Bereichs in der Skala */
const BAND_LABEL: Partial<Record<ReadinessFactor['key'], string>> = {
  sleep: 'Zielbereich',
  deep: 'typisch 1–2 h',
  hrv: 'dein Normalbereich',
  rhr: 'dein Normalbereich',
  water: 'Ziel erreicht',
  protein: 'Ziel erreicht',
}

/** Punkte mit echtem Minuszeichen: „+5“, „−4“, „±0“. */
export const pts = (e: number) => (e > 0 ? `+${e}` : e < 0 ? `−${-e}` : '±0')

export function ReadinessFactors({ r }: { r: Readiness }) {
  const list = [...r.factors].sort((a, b) => b.effect - a.effect)
  const scale = Math.max(6, ...list.map((f) => Math.abs(f.effect)))
  const plus = list.reduce((s, f) => s + Math.max(0, f.effect), 0)
  const minus = list.reduce((s, f) => s + Math.min(0, f.effect), 0)

  return (
    <div className="overflow-hidden rounded-2xl bg-cream">
      {/* Bilanz: Start → hebt → senkt */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2 pt-3 text-xs">
        <span className="tabular rounded-full bg-sand px-2 py-0.5 font-semibold text-cocoa-light">Start {BASE}</span>
        {plus > 0 && (
          <span className="tabular flex items-center gap-0.5 rounded-full bg-good/15 px-2 py-0.5 font-semibold text-good">
            <ArrowUp size={12} strokeWidth={2.5} />
            {pts(plus)} hebt
          </span>
        )}
        {minus < 0 && (
          <span className="tabular flex items-center gap-0.5 rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-cocoa">
            <ArrowDown size={12} strokeWidth={2.5} className="text-gold" />
            {pts(minus)} senkt
          </span>
        )}
        <span className="tabular ml-auto font-semibold text-cocoa">= {r.score}</span>
      </div>
      <div
        className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_1.75rem_0.875rem] gap-x-2.5 px-4 pb-1 text-[10px] font-semibold uppercase tracking-wide text-cocoa-muted"
        aria-hidden
      >
        <span className="col-start-3 flex justify-between">
          <span>senkt</span>
          <span>hebt</span>
        </span>
      </div>
      <ul className="divide-y divide-sand-dark/40">
        {list.map((f) => (
          <FactorRow key={f.key} f={f} scale={scale} />
        ))}
      </ul>
      <InfoTip
        className="border-t border-sand-dark/40 px-4 py-2.5 text-[11px] text-cocoa-muted"
        info={`Die Tagesform startet bei ${BASE} Punkten. Jeder Wert schiebt sie nach oben (grün) oder unten (gold) – je länger der Balken, desto stärker. Was deine Uhr nicht misst, zählt neutral.`}
      >
        So wird gerechnet
      </InfoTip>
    </div>
  )
}

function FactorRow({ f, scale }: { f: ReadinessFactor; scale: number }) {
  const [open, setOpen] = useState(false)
  const Icon = FACTOR_ICON[f.key]
  return (
    <li>
      <button
        className="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_4.75rem_1.75rem_0.875rem] items-center gap-x-2.5 px-4 py-2.5 text-left active:bg-sand/60"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${f.label}: ${f.value}, ${pts(f.effect)} Punkte`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-sand text-cocoa-light">
          <Icon size={17} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{f.label}</span>
          <span className="tabular block truncate text-xs text-cocoa-light">
            <span className="font-semibold text-cocoa">{f.value}</span>
            {f.normal && <span className="text-cocoa-muted"> · {f.normal}</span>}
          </span>
        </span>
        <ImpactBar effect={f.effect} scale={scale} />
        <span
          className={`tabular text-right text-xs font-bold ${
            f.effect > 0 ? 'text-good' : f.effect < 0 ? 'text-cocoa' : 'text-cocoa-muted'
          }`}
        >
          {pts(f.effect)}
        </span>
        <ChevronDown size={14} className={`text-cocoa-muted transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="anim-fade space-y-2 px-4 pb-3 pl-[3.75rem]">
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-sm">{f.text}</span>
            <StatusChip status={f.status} />
          </div>
          {f.range && (
            <div>
              <RangeBar range={f.range} status={f.status} />
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-cocoa-muted">
                <span className="inline-block h-1.5 w-3 rounded-full bg-sand-dark" aria-hidden />
                {BAND_LABEL[f.key] ?? f.normal ?? 'Zielbereich'}
              </p>
            </div>
          )}
          <p className="flex gap-1.5 text-xs leading-relaxed text-cocoa-light">
            <Info size={13} className="mt-0.5 shrink-0" />
            {FACTOR_INFO[f.key]}
          </p>
        </div>
      )}
    </li>
  )
}

/** Kurzfassung für die Hero-Karte/das Widget: die drei stärksten Faktoren mit Pfeil. */
export function FactorChips({ r, n = 3 }: { r: Readiness; n?: number }) {
  const top = r.factors.filter((f) => f.effect !== 0).slice(0, n)
  if (!top.length) return null
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {top.map((f) => (
        <span
          key={f.key}
          className="tabular inline-flex items-center gap-0.5 rounded-full bg-bg/10 px-1.5 py-0.5 text-[11px] font-semibold dark:bg-white/5"
        >
          {f.effect > 0 ? (
            <ArrowUp size={11} strokeWidth={3} className="text-good" />
          ) : (
            <ArrowDown size={11} strokeWidth={3} className="text-gold" />
          )}
          {f.label}
        </span>
      ))}
    </span>
  )
}
