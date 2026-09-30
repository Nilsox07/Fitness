import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarDays } from 'lucide-react'
import { usePrefs } from '../lib/prefs'

/** Kopf des Fortschritt-Tabs (neue App): Umschalter Verlauf ↔ Statistik. */
export function ProgressSwitch() {
  const { world } = usePrefs()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const items = [
    { to: '/history', label: world === 'food' ? 'Tage' : 'Verlauf', Icon: CalendarDays },
    { to: '/analytics', label: 'Statistik', Icon: BarChart3 },
  ]
  return (
    <div className="flex gap-1 rounded-full bg-sand p-1">
      {items.map(({ to, label, Icon }) => {
        const active = pathname === to
        return (
          <button
            key={to}
            onClick={() => !active && navigate(to, { replace: true })}
            aria-pressed={active}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-sm font-semibold transition-colors duration-200 ${
              active ? 'bg-sand-light text-cocoa shadow-sm dark:bg-sand-dark' : 'text-cocoa-light'
            }`}
          >
            <Icon size={16} className={active ? 'text-brand' : ''} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
