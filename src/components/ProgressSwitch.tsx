import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  Apple,
  BedDouble,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  HeartPulse,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { usePrefs, type World } from '../lib/prefs'
import { useHealthActivities, useHealthDaily, useHealthSleep } from '../hooks/useHealth'
import { capabilities } from '../lib/health'

type Item = { id: string; label: string; Icon: LucideIcon; to: string; world?: World; tint: string }

/**
 * Kopf des Fortschritt-Tabs (neue App): eine Leiste für alle Bereiche –
 * Kraft · Ausdauer · Schlaf · Herz & Körper · Ernährung · Erfolge.
 * Uhr-Bereiche nur mit Smartwatch, Ernährung nur mit dem Modul.
 */
export function ProgressSwitch({ extra }: { extra?: ReactNode } = {}) {
  const { world, setWorld, showNutrition, hasWatch } = usePrefs()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const row = useRef<HTMLDivElement>(null)
  // Nicht jede Uhr zeichnet Schlaf auf – dann den Reiter gar nicht erst anbieten
  const { data: sleep } = useHealthSleep(30)
  const { data: daily } = useHealthDaily(30)
  const { data: acts } = useHealthActivities(30)
  const caps = hasWatch ? capabilities(daily ?? [], sleep ?? [], acts ?? []) : null
  const showSleep = !caps?.known || caps.has.sleep || caps.has.hrv

  const items: Item[] = [
    { id: 'strength', label: 'Kraft', Icon: Dumbbell, to: '/analytics', world: 'fitness', tint: 'text-brand' },
    ...(hasWatch
      ? [
          { id: 'cardio', label: 'Ausdauer', Icon: Activity, to: '/cardio', tint: 'text-orange-500' },
          ...(showSleep
            ? [{ id: 'sleep', label: 'Schlaf', Icon: BedDouble, to: '/sleep', tint: 'text-indigo-500' }]
            : []),
          { id: 'vitals', label: 'Herz & Körper', Icon: HeartPulse, to: '/vitals', tint: 'text-red-500' },
        ]
      : []),
    ...(showNutrition
      ? [
          {
            id: 'food',
            label: 'Ernährung',
            Icon: Apple,
            to: '/analytics',
            world: 'food' as const,
            tint: 'text-success',
          },
        ]
      : []),
    { id: 'badges', label: 'Erfolge', Icon: Trophy, to: '/badges', tint: 'text-gold' },
  ]
  const activeId =
    pathname === '/analytics'
      ? world === 'food' && showNutrition
        ? 'food'
        : 'strength'
      : (items.find((i) => pathname === i.to || pathname.startsWith(i.to + '/'))?.id ?? '')

  // Aktiven Reiter sichtbar halten
  useEffect(() => {
    // Nur die Leiste verschieben (scrollIntoView würde auch die Seite seitlich bewegen)
    const r = row.current
    const el = r?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (r && el) r.scrollLeft = el.offsetLeft - r.clientWidth / 2 + el.clientWidth / 2
  }, [activeId])

  if (pathname === '/history') return null
  const onAnalytics = pathname === '/analytics'

  return (
    <div className="space-y-2">
      <div ref={row} className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        {items.map(({ id, label, Icon, to, world: w, tint }) => {
          const active = id === activeId
          return (
            <button
              key={id}
              onClick={() => {
                if (w) setWorld(w)
                if (pathname !== to) navigate(to, { replace: true })
              }}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-200 ${
                active ? 'bg-cocoa text-bg dark:bg-sand-dark dark:text-cocoa' : 'bg-sand text-cocoa-light'
              }`}
            >
              <Icon size={15} className={active ? '' : tint} />
              {label}
            </button>
          )
        })}
      </div>
      {onAnalytics && (
        <div className="flex items-center justify-between gap-2">
          {extra ?? <span />}
          <Link
            to="/history"
            className="flex items-center gap-1 rounded-full bg-cream px-3 py-1.5 text-sm font-semibold text-cocoa transition active:scale-95"
          >
            <CalendarDays size={15} className="text-brand" />
            {world === 'food' ? 'Alle Tage' : 'Verlauf'}
            <ChevronRight size={15} className="text-cocoa-muted" />
          </Link>
        </div>
      )}
      {!onAnalytics && extra}
    </div>
  )
}
