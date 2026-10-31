import { useState } from 'react'
import { Check, HeartPulse, Info } from 'lucide-react'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { useHealthActivities } from '../../hooks/useHealth'
import { usePrefs } from '../../lib/prefs'
import { localDate, shiftDate } from '../../lib/day'
import { weekdayIndex } from '../../lib/schedule'
import { WEEKDAYS, cardioHowTo, cardioTitle } from '../../lib/onboarding'

/** Ausdauer-Plan aus dem Intro: heutige Einheit abhaken, Woche als Punkte. Erklärung nur auf Tippen. */
export function CardioPlanCard() {
  const { prefs, save } = useUserPrefs()
  const { hasWatch } = usePrefs()
  const { data: acts } = useHealthActivities(14)
  const [info, setInfo] = useState(false)
  const plan = prefs.cardioPlan
  if (!plan) return null

  const today = localDate()
  const wd = weekdayIndex(today)
  const monday = shiftDate(today, -wd)
  const watchDays = new Set(hasWatch ? (acts ?? []).map((a) => a.started_at.slice(0, 10)) : [])
  const isDone = (date: string) => prefs.cardioDone.includes(date) || watchDays.has(date)

  const todays = plan.sessions.find((s) => s.day === wd)
  const upcoming = plan.sessions.find((s) => s.day > wd) ?? plan.sessions[0]
  const shown = todays ?? upcoming
  const doneToday = !!todays && isDone(today)

  function toggle() {
    const next = doneToday ? prefs.cardioDone.filter((d) => d !== today) : [...prefs.cardioDone, today]
    void save({ cardioDone: next })
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sand text-cocoa-light">
          <HeartPulse size={22} />
        </span>
        <button className="min-w-0 flex-1 text-left" onClick={() => setInfo((v) => !v)}>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-cocoa-muted">
            {todays ? 'Ausdauer heute' : `Ausdauer · ${WEEKDAYS[shown.day]}`}
          </span>
          <span className="flex items-center gap-1.5 text-[17px] font-bold">
            <span className="truncate">{cardioTitle(shown)}</span>
            <Info size={14} className="shrink-0 text-cocoa-muted" />
          </span>
        </button>
        {todays && (
          <button
            onClick={toggle}
            aria-pressed={doneToday}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
              doneToday ? 'bg-success text-on-brand' : 'bg-brand/10 text-brand'
            }`}
          >
            {doneToday ? (
              <span className="flex items-center gap-1">
                <Check size={14} strokeWidth={3} /> Erledigt
              </span>
            ) : (
              'Abhaken'
            )}
          </button>
        )}
      </div>
      {info && <p className="anim-fade text-sm text-cocoa-light">{cardioHowTo(shown)}</p>}
      <div className="flex justify-between px-1">
        {WEEKDAYS.map((w, d) => {
          const has = plan.sessions.some((s) => s.day === d)
          const done = has && isDone(shiftDate(monday, d))
          return (
            <span key={w} className="flex flex-col items-center gap-1">
              <span
                className={`grid h-5 w-5 place-items-center rounded-full ${
                  done ? 'bg-success text-on-brand' : has ? 'ring-2 ring-brand/40' : 'bg-sand'
                }`}
              >
                {done && <Check size={11} strokeWidth={3} />}
              </span>
              <span className={`text-[10px] ${d === wd ? 'font-bold text-brand' : 'text-cocoa-muted'}`}>{w}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
