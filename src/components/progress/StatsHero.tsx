import type { ReactNode } from 'react'
import { Dumbbell, Layers, Trophy } from 'lucide-react'
import { useCountUp } from '../food/useCountUp'
import { enter } from '../home/motion'
import { AreaSpark } from './Sparklines'

const nf = (n: number, digits = 0) =>
  n.toLocaleString('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits })

function Pill({ icon, value, label, accent }: { icon: ReactNode; value: number; label: string; accent?: boolean }) {
  const anim = useCountUp(value, 600)
  return (
    <div className="min-w-0 rounded-2xl bg-bg/10 px-3 py-2.5 dark:bg-white/5">
      <div className={`tabular flex items-center gap-1.5 text-lg font-bold leading-tight ${accent ? 'text-gold' : ''}`}>
        {icon}
        {nf(Math.round(anim))}
      </div>
      <div className="truncate text-[11px] text-bg/60 dark:text-cocoa-light">{label}</div>
    </div>
  )
}

/** Trend-Chip auf dunklem Grund: steigend grün, fallend neutral. */
function TrendChip({ pct, compare }: { pct: number | null; compare: string }) {
  if (pct === null) return null
  const up = pct > 0
  const down = pct < 0
  return (
    <span
      className={`tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? 'bg-success/20 text-success' : 'bg-bg/10 text-bg/70 dark:bg-white/5 dark:text-cocoa-light'
      }`}
      title={`ggü. ${compare}`}
    >
      {up ? '▲' : down ? '▼' : '±'} {nf(Math.abs(pct))} %
    </span>
  )
}

/**
 * Dunkle Hero-Karte der Statistik: Volumen des Zeitraums (hochzählend) mit
 * Trend, weicher Verlaufskurve (kumuliert, Vorzeitraum gestrichelt) und drei
 * Kennzahlen-Pillen.
 */
export function StatsHero({
  label,
  volumeKg,
  trend,
  compare,
  spark,
  ghost,
  length,
  axis,
  sessions,
  sets,
  prs,
  index,
}: {
  label: string
  volumeKg: number
  trend: number | null
  /** „Vormonat" o. Ä. */
  compare: string
  spark: number[]
  ghost: number[]
  length: number
  axis: [string, string]
  sessions: number
  sets: number
  prs: number
  index: number
}) {
  const anim = useCountUp(volumeKg, 800)
  const tons = volumeKg >= 1000
  const value = tons ? nf(anim / 1000, 1) : nf(Math.round(anim))

  return (
    <section
      className="relative overflow-hidden rounded-3xl bg-cocoa p-5 text-bg shadow-lg shadow-black/10 dark:bg-sand-light dark:text-cocoa dark:shadow-none"
      style={enter(index)}
    >
      <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-bg/60 dark:text-cocoa-light">
            Volumen · {label}
          </p>
          <TrendChip pct={trend} compare={compare} />
        </div>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span className="tabular text-5xl font-bold tracking-tight">{value}</span>
          <span className="text-xl font-semibold text-bg/60 dark:text-cocoa-light">{tons ? 't' : 'kg'}</span>
        </p>

        <AreaSpark values={spark} ghost={ghost} length={length} height={64} className="mt-3" />
        <div className="mt-1.5 flex justify-between text-[10px] text-bg/45 dark:text-cocoa-muted">
          <span>{axis[0]}</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-t border-dashed border-current" />
            {compare}
          </span>
          <span>{axis[1]}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Pill icon={<Dumbbell size={15} className="text-brand" />} value={sessions} label="Trainings" />
          <Pill icon={<Layers size={15} className="text-brand" />} value={sets} label="Sätze" />
          <Pill
            icon={
              <Trophy
                size={15}
                strokeWidth={2.5}
                className={prs > 0 ? 'text-gold' : 'text-bg/40 dark:text-cocoa-muted'}
              />
            }
            value={prs}
            label={prs === 1 ? 'Rekord' : 'Rekorde'}
            accent={prs > 0}
          />
        </div>
      </div>
    </section>
  )
}
