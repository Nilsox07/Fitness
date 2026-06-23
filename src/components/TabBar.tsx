import { NavLink } from 'react-router-dom'
import { usePrefs } from '../lib/prefs'

export function TabBar() {
  const { showNutrition } = usePrefs()

  const tabs = [
    { to: '/', label: 'Training', icon: '🏋️' },
    ...(showNutrition ? [{ to: '/nutrition', label: 'Essen', icon: '🍎' }] : []),
    { to: '/history', label: 'Verlauf', icon: '🗓️' },
    { to: '/analytics', label: 'Auswertung', icon: '📈' },
    { to: '/exercises', label: 'Übungen', icon: '📋' },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-sand-dark bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                isActive ? 'text-brand' : 'text-cocoa-light'
              }`
            }
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
