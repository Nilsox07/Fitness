import { useEffect, useRef, type CSSProperties } from 'react'
import { Ring } from '../nutrition-home/Ring'
import type { PlanDay } from '../../types'
import { dayShort, dayTotals } from './planUtils'

/** Horizontale Tagesleiste: je Plan-Tag ein kleiner kcal-Ring (Fortschritt zum Tagesziel). */
export function DayStrip({
  days,
  selected,
  onSelect,
  kcalTarget,
  style,
}: {
  days: PlanDay[]
  selected: number
  onSelect: (i: number) => void
  kcalTarget: number
  style?: CSSProperties
}) {
  const scroller = useRef<HTMLDivElement>(null)

  // ausgewählten Tag sichtbar halten (z. B. bei 14 Tagen)
  const fits = days.length <= 7
  useEffect(() => {
    if (fits) return
    const el = scroller.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [selected, fits])

  return (
    <div className="card px-1.5 py-2" style={style}>
      <div
        ref={scroller}
        className={`flex gap-0.5 [scrollbar-width:none] ${fits ? '' : 'overflow-x-auto'}`}
        role="tablist"
        aria-label="Plan-Tage"
      >
        {days.map((d, i) => {
          const sel = i === selected
          const kcal = dayTotals(d).kcal
          return (
            <button
              key={i}
              data-day={i}
              role="tab"
              aria-selected={sel}
              aria-label={`${d.label}, ${Math.round(kcal)} kcal`}
              onClick={() => onSelect(i)}
              className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors duration-200 ${
                fits ? 'min-w-0 flex-1' : 'w-12 shrink-0'
              } ${sel ? 'bg-cocoa text-cream' : 'text-cocoa'}`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${sel ? 'text-cream/70' : 'text-cocoa-muted'}`}
              >
                {dayShort(d.label)}
              </span>
              <Ring
                size={32}
                stroke={3}
                progress={kcalTarget > 0 ? kcal / kcalTarget : 0}
                trackClass={sel ? 'stroke-cream/25' : 'stroke-sand-dark/60'}
                overClass="stroke-gold"
              >
                <span className="tabular text-xs font-semibold">{i + 1}</span>
              </Ring>
            </button>
          )
        })}
      </div>
    </div>
  )
}
