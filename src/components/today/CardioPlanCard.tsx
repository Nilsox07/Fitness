import { useState } from 'react'
import { Check, HeartPulse, Info, Sparkles } from 'lucide-react'
import { useUserPrefs } from '../../hooks/usePrefsSync'
import { useHealthActivities } from '../../hooks/useHealth'
import { usePrefs } from '../../lib/prefs'
import { localDate, shiftDate } from '../../lib/day'
import { weekdayIndex } from '../../lib/schedule'
import { WEEKDAYS, cardioHowTo, cardioTitle } from '../../lib/onboarding'
import { useGymWeek } from '../../hooks/useGymWeek'
import { arrangeCardio, hybridIssues, isHard, todayAdvice } from '../../lib/hybrid'

/**
 * Ausdauer-Plan (Hybrid): heutige Einheit abhaken, darunter die Woche mit Kraft- und Ausdauertagen.
 * Passt etwas nicht (z. B. Intervalle vor dem Beintag), zeigt die Karte es und verteilt auf Wunsch neu.
 */
export function CardioPlanCard() {
  const { prefs, save } = useUserPrefs()
  const { hasWatch, hasHybrid } = usePrefs()
  const { data: acts } = useHealthActivities(14)
  const [info, setInfo] = useState(false)
  const [moved, setMoved] = useState(false)
  const gym = useGymWeek()
  const plan = prefs.cardioPlan
  if (!plan || !hasHybrid) return null

  const today = localDate()
  const wd = weekdayIndex(today)
  const monday = shiftDate(today, -wd)
  const watchDays = new Set(hasWatch ? (acts ?? []).map((a) => a.started_at.slice(0, 10)) : [])
  const isDone = (date: string) => prefs.cardioDone.includes(date) || watchDays.has(date)

  const todays = plan.sessions.find((s) => s.day === wd)
  const upcoming = plan.sessions.find((s) => s.day > wd) ?? plan.sessions[0]
  const shown = todays ?? upcoming
  const doneToday = !!todays && isDone(today)

  const issues = gym.known ? hybridIssues(plan.sessions, gym.week) : []
  const warnDays = new Set(issues.filter((i) => i.severity === 'warn').map((i) => i.day))
  const better = gym.known ? arrangeCardio(plan.sessions, gym.week) : null
  const advice = gym.known && todays && !doneToday ? todayAdvice(todays, gym.week) : null

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
          <span className="block text-[17px] font-bold leading-tight">{cardioTitle(shown).split(' · ')[0]}</span>
          <span className="flex items-center gap-1 text-xs text-cocoa-light">
            {shown.minutes} min <Info size={12} className="shrink-0 text-cocoa-muted" />
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
      {advice && <p className="rounded-xl bg-gold/15 px-3 py-2 text-xs font-semibold text-cocoa">{advice}</p>}

      {/* Woche: oben Kraft (Beintag kräftig), unten Ausdauer (hart = gefüllt, locker = Ring) */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, d) => {
          const g = gym.week[d]
          const c = plan.sessions.find((x) => x.day === d)
          const done = !!c && isDone(shiftDate(monday, d))
          const warn = warnDays.has(d)
          return (
            <div
              key={w}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${warn ? 'bg-gold/15 ring-1 ring-gold/60' : ''}`}
            >
              <span
                title={g?.planName}
                className={`h-2 w-6 rounded-full ${g?.legs ? 'bg-brand' : g?.gym ? 'bg-brand/35' : 'bg-transparent'}`}
              />
              <span
                className={`grid h-5 w-5 place-items-center rounded-full ${
                  done
                    ? 'bg-success text-on-brand'
                    : c
                      ? isHard(c)
                        ? 'bg-brand/80'
                        : 'ring-2 ring-brand/50'
                      : 'bg-sand'
                }`}
              >
                {done && <Check size={11} strokeWidth={3} />}
              </span>
              <span className={`text-[10px] ${d === wd ? 'font-bold text-brand' : 'text-cocoa-muted'}`}>{w}</span>
            </div>
          )
        })}
      </div>
      {gym.known && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] text-cocoa-muted">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full bg-brand" /> Beine
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full bg-brand/35" /> Kraft
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-brand/80" /> hart
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full ring-2 ring-brand/50" /> locker
          </span>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="space-y-1">
          {issues.slice(0, 2).map((i) => (
            <li key={i.kind + i.day} className="flex gap-1.5 text-xs text-cocoa-light">
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${i.severity === 'warn' ? 'bg-gold' : 'bg-sand-dark'}`}
              />
              {i.text}
            </li>
          ))}
        </ul>
      )}
      {better && (
        <button
          onClick={() => {
            void save({ cardioPlan: { ...plan, sessions: better } })
            setMoved(true)
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand py-2.5 text-sm font-semibold text-on-brand"
        >
          <Sparkles size={15} /> Automatisch abstimmen
        </button>
      )}
      {moved && !better && issues.every((i) => i.severity !== 'warn') && (
        <p className="text-center text-xs font-semibold text-success">
          Abgestimmt – Kraft und Ausdauer passen zusammen
        </p>
      )}
      {!gym.known && (
        <p className="text-[11px] text-cocoa-muted">
          Mit festen Trainingstagen stimme ich Kraft und Ausdauer aufeinander ab.
        </p>
      )}
    </div>
  )
}
