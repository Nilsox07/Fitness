import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { enter } from '../home/motion'
import { formatVolume, intensityLevel, monthGrid, MONTHS_LONG, shiftMonth } from './progressUtils'

const LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

// Intensität per Deckkraft der Brand-Farbe (Stufen 1–4)
const FILL: Record<1 | 2 | 3 | 4, string> = {
  1: 'bg-brand/35 text-cocoa',
  2: 'bg-brand/55 text-cocoa',
  3: 'bg-brand/80 text-on-brand',
  4: 'bg-brand text-on-brand shadow-sm shadow-brand/30',
}

/**
 * Monatskalender als Heatmap (Mo–So): trainierte Tage in Brand-Farbe, je nach
 * Volumen kräftiger; heute umrandet. Tippen auf einen Tag → `onPick`.
 */
export function MonthHeatmap({
  today,
  volumeByDate,
  onPick,
  index,
}: {
  today: string
  /** Tagesvolumen (kg) je trainiertem Tag — auch 0 für Tage ohne Gewicht */
  volumeByDate: Map<string, number>
  onPick: (date: string) => void
  index: number
}) {
  const current = today.slice(0, 7)
  const [month, setMonth] = useState(current)
  const rows = useMemo(() => monthGrid(month), [month])
  const first = useMemo(() => [...volumeByDate.keys()].sort()[0]?.slice(0, 7) ?? current, [volumeByDate, current])

  const inMonth = rows.flat().filter((d): d is string => d != null && volumeByDate.has(d))
  const max = Math.max(0, ...inMonth.map((d) => volumeByDate.get(d) ?? 0))
  const total = inMonth.reduce((s, d) => s + (volumeByDate.get(d) ?? 0), 0)
  const [y, m] = month.split('-').map(Number)
  const canPrev = month > first
  const canNext = month < current

  return (
    <section className="card space-y-3" style={enter(index)} aria-label="Trainingskalender">
      <div className="flex items-center gap-2">
        <button
          className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light disabled:opacity-30"
          onClick={() => setMonth((mm) => shiftMonth(mm, -1))}
          disabled={!canPrev}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="font-semibold">
            {MONTHS_LONG[m - 1]}
            {y !== Number(today.slice(0, 4)) && ` ${y}`}
          </div>
          <div className="tabular text-[11px] text-cocoa-muted">
            {inMonth.length} {inMonth.length === 1 ? 'Training' : 'Trainings'}
            {total > 0 && ` · ${formatVolume(total)}`}
          </div>
        </div>
        <button
          className="grid h-8 w-8 place-items-center rounded-full bg-sand text-cocoa-light disabled:opacity-30"
          onClick={() => setMonth((mm) => shiftMonth(mm, 1))}
          disabled={!canNext}
          aria-label="Nächster Monat"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5" key={month}>
        {LABELS.map((l) => (
          <span key={l} className="text-center text-[10px] font-medium text-cocoa-muted">
            {l}
          </span>
        ))}
        {rows.flat().map((d, i) => {
          if (!d) return <span key={`e${i}`} />
          const trained = volumeByDate.has(d)
          const isToday = d === today
          const future = d > today
          const day = Number(d.slice(8))
          const ring = isToday ? 'ring-2 ring-brand ring-offset-2 ring-offset-cream' : ''
          const base = `tabular mx-auto grid aspect-square w-full max-w-[40px] place-items-center rounded-xl text-xs font-semibold ${ring}`
          if (trained) {
            const vol = volumeByDate.get(d) ?? 0
            return (
              <button
                key={d}
                className={`${base} ${FILL[intensityLevel(vol, max)]} transition active:scale-90`}
                style={{ animation: 'fade-in .3s ease-out both', animationDelay: `${i * 12}ms` }}
                onClick={() => onPick(d)}
                aria-label={`${day}. ${MONTHS_LONG[m - 1]}: ${formatVolume(vol)} — Training öffnen`}
              >
                {day}
              </button>
            )
          }
          return (
            <span
              key={d}
              className={`${base} ${future ? 'text-cocoa-muted/50' : 'bg-sand/70 text-cocoa-muted'}`}
            >
              {day}
            </span>
          )
        })}
      </div>

      <div className="flex items-center justify-end gap-1 text-[10px] text-cocoa-muted">
        weniger
        {([1, 2, 3, 4] as const).map((l) => (
          <span key={l} className={`h-2.5 w-2.5 rounded-[4px] ${FILL[l].split(' ')[0]}`} />
        ))}
        mehr
      </div>
    </section>
  )
}
