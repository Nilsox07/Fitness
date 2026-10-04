import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Ring } from '../nutrition-home/Ring'
import { kcalStatus, monthGrid, monthLabel, shiftMonth } from '../../lib/foodProgress'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const BAR: Record<string, string> = {
  ok: 'stroke-success',
  over: 'stroke-gold',
  under: 'stroke-brand',
  logged: 'stroke-brand/60',
}

/**
 * Monatskalender (Mo–So): je Tag ein kleiner kcal-Ring — grün im Ziel (±10 %),
 * gold drüber, Akzent anteilig darunter, leer = blasser Ring. Tipp öffnet den Tag.
 */
export function MonthCalendar({
  today,
  kcalByDate,
  targetFor,
  earliest,
  onOpen,
  style,
}: {
  today: string
  kcalByDate: Map<string, number>
  targetFor: (date: string) => number
  /** frühester Tag mit Daten — weiter zurück wird nicht geblättert */
  earliest: string | null
  onOpen: (date: string) => void
  style?: CSSProperties
}) {
  const ty = Number(today.slice(0, 4))
  const tm = Number(today.slice(5, 7))
  const [ym, setYm] = useState({ year: ty, month: tm })
  const weeks = useMemo(() => monthGrid(ym.year, ym.month), [ym])
  const isCurrent = ym.year === ty && ym.month === tm
  const minKey = earliest ? Number(earliest.slice(0, 4)) * 12 + Number(earliest.slice(5, 7)) : ty * 12 + tm
  const canBack = ym.year * 12 + ym.month > Math.min(minKey, ty * 12 + tm)

  const chev =
    'grid h-8 w-8 place-items-center rounded-full text-cocoa-light transition-colors duration-200 active:bg-sand disabled:pointer-events-none disabled:opacity-30'

  return (
    <section className="card px-3 pb-3 pt-2" style={style}>
      <div className="mb-1 flex items-center justify-between">
        <button
          className={chev}
          onClick={() => setYm((v) => shiftMonth(v.year, v.month, -1))}
          disabled={!canBack}
          aria-label="Vorheriger Monat"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="font-semibold capitalize" aria-live="polite">
          {monthLabel(ym.year, ym.month)}
        </h2>
        <button
          className={chev}
          onClick={() => setYm((v) => shiftMonth(v.year, v.month, 1))}
          disabled={isCurrent}
          aria-label="Nächster Monat"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-cocoa-muted">
            {w}
          </span>
        ))}
        {weeks.flat().map((d, i) => {
          if (!d) return <span key={`x${i}`} />
          const future = d > today
          const isToday = d === today
          const kcal = kcalByDate.get(d) ?? 0
          const logged = kcalByDate.has(d)
          const target = targetFor(d)
          const status = kcalStatus(kcal, target, logged)
          const progress =
            status === 'empty' ? 0 : status === 'over' || status === 'logged' ? 1 : target > 0 ? kcal / target : 0
          const dayNum = Number(d.slice(8))
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => onOpen(d)}
              aria-label={`${dayNum}. ${logged ? `${Math.round(kcal)} kcal` : 'nichts erfasst'}${isToday ? ' (heute)' : ''}`}
              aria-current={isToday ? 'date' : undefined}
              className={`mx-auto grid place-items-center rounded-full p-[3px] transition active:scale-90 disabled:opacity-30 ${
                isToday ? 'bg-brand/10 ring-1 ring-brand/40' : ''
              }`}
            >
              <Ring
                size={30}
                stroke={3}
                progress={Math.min(1, progress)}
                trackClass={status === 'empty' ? 'stroke-sand-dark/35' : 'stroke-sand-dark/60'}
                barClass={BAR[status] ?? 'stroke-brand'}
              >
                <span
                  className={`tabular text-[11px] font-semibold ${
                    isToday ? 'text-brand' : status === 'empty' ? 'text-cocoa-muted' : 'text-cocoa'
                  }`}
                >
                  {dayNum}
                </span>
              </Ring>
            </button>
          )
        })}
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-3 text-[10px] text-cocoa-muted">
        <Legend cls="bg-success" label="Im Ziel" />
        <Legend cls="bg-gold" label="Drüber" />
        <Legend cls="bg-brand" label="Drunter" />
      </div>
    </section>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-1.5 w-1.5 rounded-full ${cls}`} />
      {label}
    </span>
  )
}
