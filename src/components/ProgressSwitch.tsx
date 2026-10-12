import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Apple, CalendarDays, ChevronRight, Dumbbell, Trophy } from 'lucide-react'
import { usePrefs } from '../lib/prefs'

/**
 * Kopf des Fortschritt-Tabs (neue App): Reiter Training · Ernährung · Erfolge.
 * Der Verlauf ist eine Unterseite (Knopf darunter), damit es nur eine
 * Auswahlleiste gibt.
 */
export function ProgressSwitch() {
  const { world, setWorld, showNutrition } = usePrefs()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  if (pathname === '/history') return null

  const onBadges = pathname === '/badges'
  const items = [
    { id: 'fitness' as const, label: 'Training', Icon: Dumbbell, active: !onBadges && world === 'fitness' },
    ...(showNutrition
      ? [{ id: 'food' as const, label: 'Ernährung', Icon: Apple, active: !onBadges && world === 'food' }]
      : []),
    { id: 'badges' as const, label: 'Erfolge', Icon: Trophy, active: onBadges },
  ]

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-full bg-sand p-1">
        {items.map(({ id, label, Icon, active }) => (
          <button
            key={id}
            onClick={() => {
              if (id === 'badges') {
                if (!onBadges) navigate('/badges', { replace: true })
                return
              }
              setWorld(id)
              if (onBadges) navigate('/analytics', { replace: true })
            }}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
              active ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
            }`}
          >
            <Icon size={16} className={active ? 'text-brand' : ''} />
            {label}
          </button>
        ))}
      </div>
      {!onBadges && (
        <Link
          to="/history"
          className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3 text-sm transition active:scale-[0.99]"
        >
          <CalendarDays size={18} className="text-brand" />
          <span className="flex-1 font-semibold text-cocoa">
            {world === 'food' ? 'Alle Ernährungstage' : 'Alle Trainings'}
          </span>
          <span className="text-xs text-cocoa-muted">Verlauf</span>
          <ChevronRight size={16} className="text-cocoa-muted" />
        </Link>
      )}
    </div>
  )
}
