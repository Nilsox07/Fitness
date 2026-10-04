import { ChevronLeft, ChevronRight } from 'lucide-react'
import { shiftDate } from '../../lib/day'
import { weekOf } from '../../lib/nutritionHome'
import { Ring } from './Ring'

const LETTERS = ['M', 'D', 'M', 'D', 'F', 'S', 'S']
const NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

/**
 * Wochenleiste Mo–So: je Tag ein kleiner Ring mit dem Kalorienfortschritt.
 * Ausgewählter Tag als Pille, Zukunft deaktiviert, Pfeile springen wochenweise.
 */
export function WeekStrip({
  date,
  today,
  onChange,
  kcalByDate,
  targetFor,
}: {
  date: string
  today: string
  onChange: (d: string) => void
  kcalByDate: Map<string, number>
  targetFor: (d: string) => number
}) {
  const days = weekOf(date)
  const isCurrentWeek = days.includes(today)
  const nextWeek = () => {
    const d = shiftDate(date, 7)
    onChange(d > today ? today : d)
  }
  const chev =
    'grid h-8 w-6 shrink-0 place-items-center rounded-full text-cocoa-muted transition-colors duration-200 hover:text-cocoa disabled:pointer-events-none disabled:opacity-30'

  return (
    <div className="card flex items-center gap-0.5 px-1.5 py-2">
      <button className={chev} onClick={() => onChange(shiftDate(date, -7))} aria-label="Vorherige Woche">
        <ChevronLeft size={18} />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          const future = d > today
          const selected = d === date
          const isToday = d === today
          const kcal = kcalByDate.get(d) ?? 0
          const target = targetFor(d)
          const progress = target > 0 ? kcal / target : 0
          const dayNum = Number(d.slice(8))
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => onChange(d)}
              aria-label={`${NAMES[i]}, ${dayNum}.${isToday ? ' (heute)' : ''}`}
              aria-current={selected ? 'date' : undefined}
              className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 transition-colors duration-200 disabled:opacity-35 ${
                selected ? 'bg-cocoa text-cream' : 'text-cocoa'
              }`}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  selected ? 'text-cream/70' : isToday ? 'text-brand' : 'text-cocoa-muted'
                }`}
              >
                {LETTERS[i]}
              </span>
              <Ring
                size={32}
                stroke={3}
                progress={future ? 0 : progress}
                trackClass={selected ? 'stroke-cream/25' : 'stroke-sand-dark/60'}
                overClass="stroke-gold"
              >
                <span className={`tabular text-xs font-semibold ${!selected && isToday ? 'text-brand' : ''}`}>
                  {dayNum}
                </span>
              </Ring>
            </button>
          )
        })}
      </div>
      <button className={chev} onClick={nextWeek} disabled={isCurrentWeek} aria-label="Nächste Woche">
        <ChevronRight size={18} />
      </button>
    </div>
  )
}
