import { Check } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { weekDates } from '../../lib/home'
import { enter, pop } from './motion'

const LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Wochenleiste Mo–So: trainiert / heute / Zukunft + Wochenziel. */
export function WeekStrip({
  today,
  trainedDates,
  goal,
  index,
}: {
  today: string
  trainedDates: Set<string>
  goal: number
  index: number
}) {
  const navigate = useNavigate()
  const days = weekDates(today)
  const count = days.filter((d) => trainedDates.has(d)).length
  const reached = count >= goal

  return (
    <section className="card space-y-3" style={enter(index)} aria-label="Diese Woche">
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const trained = trainedDates.has(d)
          const isToday = d === today
          const future = d > today
          const num = Number(d.slice(8))
          const base = 'mx-auto grid h-9 w-9 place-items-center rounded-full text-xs font-semibold tabular'
          const look = trained
            ? 'bg-brand text-on-brand shadow-sm shadow-brand/30'
            : isToday
              ? 'bg-bg text-cocoa ring-2 ring-brand'
              : future
                ? 'text-cocoa-muted ring-1 ring-inset ring-sand-dark/60'
                : 'bg-sand text-cocoa-light'
          return (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span
                className={`text-[11px] font-medium ${isToday ? 'text-brand' : 'text-cocoa-muted'}`}
              >
                {LABELS[i]}
              </span>
              {trained && !isToday ? (
                <button
                  className={`${base} ${look}`}
                  style={pop(120 + i * 40)}
                  onClick={() => navigate('/history')}
                  aria-label={`${LABELS[i]}: trainiert — Verlauf öffnen`}
                >
                  <Check size={16} strokeWidth={3} />
                </button>
              ) : (
                <span
                  className={`${base} ${look}`}
                  style={trained ? pop(120 + i * 40) : undefined}
                  aria-label={`${LABELS[i]}${trained ? ': trainiert' : isToday ? ': heute' : ''}`}
                >
                  {trained ? <Check size={16} strokeWidth={3} /> : num}
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
          <div
            className={`h-full rounded-full transition-[width] duration-700 ease-out ${reached ? 'bg-success' : 'bg-brand'}`}
            style={{ width: `${Math.min(100, Math.round((count / goal) * 100))}%` }}
          />
        </div>
        <p className="shrink-0 text-xs text-cocoa-light">
          <span className={`tabular font-bold ${reached ? 'text-success' : 'text-cocoa'}`}>
            {count} / {goal}
          </span>{' '}
          Trainings diese Woche
        </p>
      </div>
    </section>
  )
}
