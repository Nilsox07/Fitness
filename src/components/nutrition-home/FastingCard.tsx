import { useEffect, useState, type CSSProperties } from 'react'
import { Hourglass, TriangleAlert, UtensilsCrossed } from 'lucide-react'
import { useDietStyle } from '../../hooks/useNutrition'
import { fastingState, fastingWindow, fmtDuration, inEatingWindow, type DietStyle } from '../../lib/dietStyle'
import type { FoodEntry } from '../../types'
import { Ring } from './Ring'

/** Aktuelle Zeit, minütlich (auf die volle Minute ausgerichtet) aktualisiert. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined
    const tick = () => setNow(new Date())
    const align = setTimeout(() => {
      tick()
      interval = setInterval(tick, 60_000)
    }, 60_000 - (Date.now() % 60_000) + 50)
    const onVis = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(align)
      if (interval) clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])
  return now
}

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Heute außerhalb des Essensfensters geloggte Einträge (nach Erfassungszeit). */
export function entriesOutsideWindow(
  entries: Pick<FoodEntry, 'created_at'>[],
  diet: Pick<DietStyle, 'fasting' | 'fastingStart'>,
  now: Date,
): Date[] {
  const win = fastingWindow(diet)
  if (!win) return []
  return entries
    .map((e) => new Date(e.created_at))
    .filter((d) => !Number.isNaN(d.getTime()) && sameLocalDay(d, now))
    .filter((d) => !inEatingWindow(d.getHours() * 60 + d.getMinutes(), win.startMin, win.hours))
}

const clock = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

/**
 * Intervallfasten-Timer (nur bei aktivem Fasten): Phase, Restzeit bis zum
 * nächsten Wechsel und Ring-Fortschritt. Warnt sanft (gold), wenn heute etwas
 * außerhalb des Essensfensters geloggt wurde.
 */
export function FastingCard({ entries, style }: { entries: FoodEntry[]; style?: CSSProperties }) {
  const diet = useDietStyle()
  const now = useMinuteClock()
  if (diet.fasting === 'none') return null

  const win = fastingWindow(diet)
  if (!win) {
    // 5:2 — kein tägliches Fenster
    return (
      <section className="card flex items-center gap-3" style={style}>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-sand text-cocoa">
          <Hourglass size={20} />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold">Intervallfasten 5:2</h2>
          <p className="text-sm text-cocoa-light">An 2 Tagen pro Woche nur ~500–600 kcal, sonst normal.</p>
        </div>
      </section>
    )
  }

  const st = fastingState(now, win)
  const eating = st.phase === 'eating'
  const outside = entriesOutsideWindow(entries, diet, now)

  return (
    <section className="card space-y-2" style={style} aria-live="polite">
      <div className="flex items-center gap-3">
        <Ring
          size={60}
          stroke={6}
          progress={st.progress}
          barClass={eating ? 'stroke-brand' : 'stroke-cocoa-light'}
          trackClass="stroke-sand-dark/45"
        >
          {eating ? <UtensilsCrossed size={18} className="text-brand" /> : <Hourglass size={18} className="text-cocoa" />}
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-cocoa-light">Intervallfasten {diet.fasting}</div>
          <h2 className="tabular truncate font-semibold text-cocoa">
            {eating ? 'Essensfenster offen' : 'Fasten'} · noch {fmtDuration(st.minutesLeft)}
          </h2>
          <p className="tabular truncate text-sm text-cocoa-light">
            {eating ? `Fenster schließt um ${st.nextChange}` : `Essen ab ${st.nextChange}`}
            <span className="text-cocoa-muted"> · {win.start}–{win.end}</span>
          </p>
        </div>
      </div>
      {outside.length > 0 && (
        <p className="flex items-start gap-1.5 rounded-xl bg-gold/15 px-2.5 py-1.5 text-xs text-cocoa">
          <TriangleAlert size={14} className="mt-px shrink-0 text-gold" />
          <span>
            {outside.length === 1 ? '1 Eintrag' : `${outside.length} Einträge`} heute außerhalb des
            Essensfensters ({outside.slice(0, 3).map(clock).join(', ')}) — kein Drama, morgen wieder.
          </span>
        </p>
      )}
    </section>
  )
}
